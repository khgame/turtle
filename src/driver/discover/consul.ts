import * as Consul from "consul";
import {createHttpClient, Driver, IDriverAdaptor, turtle} from "../../";
import Service = Consul.Agent.Service;

export interface IConsulConf {
    tags?: string[];
    health: {
        api: string
        interval?: string
        notes?: string
        status?: string
    };
}

@Driver("discover/consul")
export class DiscoverConsulDriver implements IDriverAdaptor<IConsulConf, any> {

    public static inst: DiscoverConsulDriver;

    protected consul: Consul.Consul;

    protected conf: IConsulConf;

    constructor() {
        DiscoverConsulDriver.inst = this;
    }

    protected loadConsul() {
        if (!require) {
            throw new Error("Cannot load consul. Try to install all required dependencies.");
        }
        if (!this.consul) {
            try {
                this.consul = require("consul")();
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

    async onStart() {
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

    async onClose() {
        await this.deregister(this.id);
    }

    get id() {
        return `${turtle.conf.name}:${turtle.conf.id}`;
    }

    async register(opts: Service.RegisterOptions) {
        return await new Promise((resolve, reject) => this.consul.agent.service.register(opts, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
    }

    async deregister(serviceId: string) {
        return await new Promise((resolve, reject) => this.consul.agent.service.deregister(serviceId, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
    }

    async httpClient(serviceName: string) { // todo: cache
        const services = await this.serviceList(serviceName);
        const servicesArr = Object.values(services).filter(s => s.Address && s.Port);
        if (!servicesArr || servicesArr.length <= 0) {
            console.log("error servicesArr", servicesArr);
            return null; // todo: cache request?
        }
        const service = servicesArr[Math.floor(Math.random() * servicesArr.length)];
        return createHttpClient(`http://${service.Address}:${service.Port}`);
    }

    async serviceList(serviceName?: string): Promise<{ [key: string]: any }> { // todo: cache
        const services: any = await new Promise((resolve, reject) => this.consul.agent.service.list((err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
        if (!serviceName) {
            return services;
        }
        const ret: any = {};
        for (const key in services) { // todo: imp this
            const service = services[key];
            if (service.Service === serviceName) {
                ret[key] = service;
            }
        }
        return ret;
    }

    async checkList(): Promise<{ [key: string]: any }> {
        return await new Promise((resolve, reject) => this.consul.agent.check.list((err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        }));
    }

    async exist() {
        const services = await this.serviceList();
        const checks = await this.checkList();

        const combinedId = this.id;
        const service = services[combinedId];
        if (!service) {
            return false;
        }

        const check = checks[`service:${combinedId}`];
        if (!check) {
            return true;
        }
        return check.Status === "passing";
    }
}



