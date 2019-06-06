import * as Consul from "consul";
import {createHttpClient, Driver, genLogger, IDriverAdaptor, turtle} from "../../";
import Service = Consul.Agent.Service;

export interface IConsulConf {
    optional?: boolean; // default false
    options?: {
        host?: string; // (String, default: 127.0.0.1): agent address
        port?: number; //  (Integer, default: 8500): agent HTTP(S) port
        secure?: boolean; // (Boolean, default: false): enable HTTPS
        ca?: string[];
    };
    health: {
        api: string;
        interval?: string;
        notes?: string;
        status?: string;
    };
    dc?: string;
    tags?: string[];
}

@Driver("discover/consul")
export class DiscoverConsulDriver implements IDriverAdaptor<IConsulConf, any> {

    public static inst: DiscoverConsulDriver;

    protected consul: Consul.Consul;

    protected conf: IConsulConf;

    protected log = genLogger();

    constructor() {
        DiscoverConsulDriver.inst = this;
    }

    protected loadConsul() {
        if (!require) {
            throw new Error("Cannot load consul. Try to install all required dependencies.");
        }
        if (!this.consul) {
            try {
                this.consul = require("consul")(this.conf.options);
            } catch (e) {
                throw new Error("consul package was not found installed. Try to install it: npm install consul --save");
            }
        }
        return this.consul;
    }

    async init(conf: IConsulConf): Promise<any> {
        this.conf = conf;
        return this.loadConsul();
    }

    async onApiStart() {
        const exist = await this.exist();
        if (exist) {
            throw new Error(`consul driver startup failed: the service ${this.id} is already exist`);
        }

        const check = {
            http: `http://localhost:${turtle.runtime.port}/${this.conf.health.api}`,
            interval: this.conf.health.interval || "5s",
            notes: this.conf.health.notes,
            status: this.conf.health.status
        };

        await this.register({
            id: `${turtle.conf.name}:${turtle.conf.id}`,
            name: turtle.conf.name,
            tags: this.conf.tags,
            address: turtle.runtime.ip,
            port: turtle.runtime.port,
            check
        });
    }

    async onApiClose() {
        await this.deregister(this.id);
    }

    get id() {
        return `${turtle.conf.name}:${turtle.conf.id}`;
    }

    async createServiceId() {
        const key = "service_id";
        let result = false;
        let newValue = 1;
        while (!result) {
            const ExistedKey = await this.get(key);
            // console.log("ExistedKey", ExistedKey);
            const Value = ExistedKey ? parseInt(ExistedKey.Value) : 0;
            const ModifyIndex = ExistedKey ? ExistedKey.ModifyIndex : -1;
            newValue = Value + 1;
            if (ModifyIndex > 0) {
                const ret = await this.cas(key, `${newValue}`, `${ModifyIndex}`);
                // console.log("ret edi :", ret);
                result = ret;
            } else {
                const ret = await this.set(key, `${newValue}`);
                // console.log("ret new :", ret);
                result = !!ret;
            }
        }
        return newValue;
    }

    async get(key: string): Promise<{
        LockIndex: number,
        Key: string,
        Flags: number,
        Value: string,
        CreateIndex: number,
        ModifyIndex: number
    }> {
        const val: any = await new Promise((resolve, reject) => this.consul.kv.get(key, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));

        return val;
    }

    async set(key: string, val: string) {
        const ret = await new Promise((resolve, reject) => this.consul.kv.set(key, val, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
        return ret;
    }

    async cas(key: string, value: string, modifyIndex: string): Promise<any> {
        const opt = {
            key, value, cas: modifyIndex
        };
        return await new Promise((resolve, reject) => this.consul.kv.set(opt, (err, result) => {
            if (err) {
                this.log.warn(`cas operation failed : ${opt} ${err}`);
                resolve(false);
            }
            resolve(result);
        }));
    }


    async register(opts: Service.RegisterOptions) {
        return await new Promise((resolve, reject) => this.consul.agent.service.register(opts, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        })).catch(ex => {
            this.log.error(`register driver discover/consul failed : ${ex}`);
            if (!this.conf.optional) {
                throw ex;
            }
        });
    }

    async deregister(serviceId: string) {
        return await new Promise((resolve, reject) => this.consul.agent.service.deregister(serviceId, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        })).catch(ex => {
            this.log.error(`deregister driver discover/consul failed : ${ex}`);
            if (!this.conf.optional) {
                throw ex;
            }
        });
    }

    async httpClient(serviceName: string) { // todo: cache
        const health: any = await new Promise((resolve, reject) =>
            this.consul.health.service(serviceName, (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            }));
        // console.log("health", JSON.stringify(health, null, 4));
        const services = health.map((h: any) => {
            if (h.Checks.find((c: any) => c.Status !== "passing")) {
                return;
            }
            const {ID, Address, Port} = h.Service;
            return {ID, Address, Port};
        }).filter((c: any) => c);
        // console.log("services", services);
        const service = services[Math.floor(services.length * Math.random())];
        const client = createHttpClient(`http://${service.Address}:${service.Port}`);
        return client;
    }

    async services() {
        const services: any = await new Promise((resolve, reject) =>
            this.consul.catalog.service.list((err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            }));
        return services;
    }

    async serviceNodes(serviceName: string): Promise<{ [key: string]: any }> { // todo: cache
        const nodes: any = await new Promise((resolve, reject) =>
            this.consul.catalog.service.nodes(serviceName, (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            }));
        console.log("=== nodes", nodes);
        return nodes;
    }


    async checkList(): Promise<{ [key: string]: any }> {
        return await new Promise((resolve, reject) => this.consul.agent.check.list((err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
    }

    async exist() { // todo
        // const services = await this.serviceList();
        const checks = await this.checkList();

        const combinedId = this.id;
        // const service = services[combinedId];
        // if (!service) {
        //     return false;
        // }

        // const check = checks[`service:${combinedId}`];
        // if (!check) {
        //     return true;
        // }
        // console.log("check", check);
        // return check.Status === "passing";

        return false;
    }
}



