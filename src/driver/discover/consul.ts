import * as Consul from "consul";
import {createHttpClient, Driver, genAssert, genLogger, http, IDriverAdaptor, turtle} from "../../";
import Service = Consul.Agent.Service;

interface IHealth {
    api?: string;
    script?: string;
    interval?: string;
    ttl?: string;
    notes?: string;
    status?: string;
}

export interface IConsulConf {
    optional?: boolean; // default false
    options?: {
        host?: string; // (String, default: 127.0.0.1): agent address
        port?: number; //  (Integer, default: 8500): agent HTTP(S) port
        secure?: boolean; // (Boolean, default: false): enable HTTPS
        ca?: string[];
    };
    health: IHealth | IHealth[];
    dc?: string;
    tags?: string[];
}


@Driver("discover/consul")
export class DiscoverConsulDriver implements IDriverAdaptor<IConsulConf, any> {

    public static inst: DiscoverConsulDriver;

    public consul: Consul.Consul;

    protected conf: IConsulConf;

    protected log = genLogger();
    public assert = genAssert();

    static assertConsulExist(driver: DiscoverConsulDriver, methodName: string) {
        driver.assert.ok(driver.consul, () => `call ${methodName} failed, cannot reach the consul agent`);
    }

    static FieldExist(object: DiscoverConsulDriver, methodName: string, descriptor: TypedPropertyDescriptor<Function>) {
        const originMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            DiscoverConsulDriver.assertConsulExist(this, methodName);
            return originMethod.apply(this, args);
        };

    }

    constructor() {
        DiscoverConsulDriver.inst = this;
    }

    protected async loadConsul() {
        if (!require) {
            throw new Error("Cannot load consul. Try to install all required dependencies.");
        }
        if (!this.consul) {
            let check;

            this.log.silly(`try connect to consul agent ${JSON.stringify(this.conf)}`);
            const options = this.conf.options || {};
            const url = `${options.secure ? "https" : "http"}://${options.host || "127.0.0.1"}:${options.port || "8500"}/v1/agent/self`;
            try {
                check = await http().get(url);
            } catch (e) {
                check = false;
                this.log.warn(`touch consul error: ${e.message}`);
            }

            if (check) {
                try {
                    this.consul = require("consul")(this.conf.options);
                } catch (e) {
                    throw new Error("consul package was not found installed. Try to install it: npm install consul --save");
                }
            } else {
                if (!this.conf.optional) {
                    throw new Error(`cannot reach the consul agent, and the optional tag is off ${this.conf.optional}`);
                } else {
                    this.log.warn(`cannot reach the consul agent, and the optional tag is open`);
                }
            }
        }
        return this.consul;
    }

    async init(conf: IConsulConf): Promise<any> {
        this.conf = conf;
        return await this.loadConsul();
    }

    async onApiStart() {
        if (!this.consul) {
            if (this.conf.optional) {
                this.log.warn(`onApiStart is skipped, optional consul is unreachable.`);
                return;
            } else {
                throw new Error(`onApiStart: cannot reach the consul agent`);
            }
        }

        const exist = await this.exist();
        if (exist) {
            throw new Error(`consul driver startup failed: the service ${this.id} is already exist`);
        }

        let check, checks;

        function healthConfToCheck(conf: IHealth) {
            return {
                http: `http://localhost:${turtle.runtime.port}/${conf.api}`,
                interval: conf.interval || "5s",
                notes: conf.notes,
                status: conf.status
            };
        }

        if (this.conf.health instanceof Array) {
            checks = this.conf.health.map(h => healthConfToCheck(h));
        } else {
            check = healthConfToCheck(this.conf.health);
        }

        const regResult = await this.register({
            id: `${turtle.conf.name}:${turtle.conf.id}`,
            name: turtle.conf.name,
            tags: this.conf.tags,
            address: turtle.runtime.ip,
            port: turtle.runtime.port,
            check,
            checks
        });

        // console.log("regResult", regResult);
    }

    async onApiClose() {
        if (!this.consul) {
            if (this.conf.optional) {
                this.log.warn(`onApiClose is skipped, optional consul is unreachable.`);
                return;
            } else {
                throw new Error(`onApiClose: cannot reach the consul agent`);
            }
        }

        await this.deregister(this.id);
    }

    get id() {
        return `${turtle.conf.name}:${turtle.conf.id}`;
    }

    @DiscoverConsulDriver.FieldExist
    async createServiceDID() {
        const key = "service_did";
        let result = false;
        let newValue = 1;
        while (!result) {
            const ExistedKey = await this.get(key);
            const Value = ExistedKey ? parseInt(ExistedKey.Value) : 0;
            const ModifyIndex = ExistedKey ? ExistedKey.ModifyIndex : 0;
            newValue = Value + 1;
            const ret = await this.cas(key, `${newValue}`, `${ModifyIndex}`);
            result = ret;
        }
        return newValue;
    }

    @DiscoverConsulDriver.FieldExist
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

    @DiscoverConsulDriver.FieldExist
    async set(key: string, val: string) {
        const ret = await new Promise((resolve, reject) => this.consul.kv.set(key, val, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
        return ret;
    }

    @DiscoverConsulDriver.FieldExist
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

    @DiscoverConsulDriver.FieldExist
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
        if (!this.consul && this.conf.optional) {
            return;
        }
        DiscoverConsulDriver.assertConsulExist(this, "deregister");
        return await new Promise((resolve, reject) => this.consul.agent.service.deregister(serviceId, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        })).catch(ex => {
            // this.log.error(`deregister driver discover/consul failed : ${ex}`);
            if (!this.conf.optional) {
                throw ex;
            }
        });
    }

    @DiscoverConsulDriver.FieldExist
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

    @DiscoverConsulDriver.FieldExist
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

    @DiscoverConsulDriver.FieldExist
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

    @DiscoverConsulDriver.FieldExist
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



