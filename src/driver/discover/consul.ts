import * as Consul from "consul";
import {createHttpClient, Driver, genAssert, genLogger, genMemCache, http, IDriverAdaptor, turtle} from "../../";
import Service = Consul.Agent.Service;
import * as fs from "fs-extra";
import * as Path from "path";
import {BigNumber} from "bignumber.js";
import {promisify} from "util";

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
    did?: {
        head_refresh?: "process" | "stable" |  "dynamic"
    };
    request_fallback: {
        [key: string]: {
            http?: string,
            https?: string,
            tcp?: string,
            udp?: string
        }
    };
}

interface IServiceNode {
    id: string;
    address: string;
    port: number;
    healthy: boolean;
}

enum NodeStatus {
    NOTEXIST,
    UNHEALTHY_ME,
    UNHEALTHY_OTHER,
    HEALTHY,
}

class DIDGenerator {

    private _idSeq = {
        time: 0,
        seq: 0
    };

    private pow2_40Str = new BigNumber(1099511627776);
    private pow2_12Str = new BigNumber(4096);

    update(header: number, base: number = 10): string {
        const timestamp = Math.floor((Date.now() - 1560096000000) / 1000);
        if (this._idSeq.time !== timestamp) {
            this._idSeq.time = timestamp;
            this._idSeq.seq = 0;
        }
        const seq = ++this._idSeq.seq;

        if (seq >= 4096) {
            throw new Error("overflow");
        }

        const did = (this.pow2_40Str.multipliedBy(header)).plus(this.pow2_12Str.multipliedBy(timestamp)).plus(seq);
        return did.toString(base);
    }

}

@Driver("discover/consul")
export class DiscoverConsulDriver implements IDriverAdaptor<IConsulConf, any> {

    public static inst: DiscoverConsulDriver;

    public consul: Consul.Consul;

    public didHead: number;

    protected conf: IConsulConf;

    protected log = genLogger();
    public assert = genAssert();

    protected servicesCache = genMemCache();
    protected httpClientCache = genMemCache();

    private didGenerator = new DIDGenerator();

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

        const status = await this.getStatusSelf();
        if (status === NodeStatus.HEALTHY || status === NodeStatus.UNHEALTHY_OTHER) {
            throw new Error(`consul driver startup failed: the service ${this.id} is already exist(${status})`);
        } else if (status === NodeStatus.UNHEALTHY_ME) {
            this.log.warn(`unhealthy me ${this.id}(${status}) detected: override`);
        } else {
            this.log.info(`me ${this.id}(${status}) are not exist: start to register`);
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
    async createServiceDIDHeader(): Promise<number> {
        const key = "service_did";

        const headRefreshRule = this.conf && this.conf.did && this.conf.did.head_refresh ? this.conf.did.head_refresh : "process";
        const didFilePath = Path.resolve(process.cwd(), `.${turtle.conf.name}-${turtle.conf.id}.turtle.did`);

        if (headRefreshRule !== "dynamic") {
            if (this.didHead) {
                return this.didHead;
            }
            if (headRefreshRule === "stable" && fs.existsSync(didFilePath)) {
                const didStr = fs.readJsonSync(didFilePath);
                if (didStr) {
                    return this.didHead = parseInt(didStr.head);
                }
            }
        }

        let result = false;
        this.didHead = this.didHead || 0;
        while (!result) {
            const ExistedKey = await this.get(key);
            const Value = ExistedKey ? parseInt(ExistedKey.Value) : 0;
            const ModifyIndex = ExistedKey ? ExistedKey.ModifyIndex : 0;
            this.didHead = Value + 1;
            const ret = await this.cas(key, `${this.didHead}`, `${ModifyIndex}`);
            result = ret;
        }

        if (headRefreshRule !== "dynamic" && this.didHead !== 0) { // this.didHead === 0 means error
            fs.writeJSONSync(didFilePath, {head: this.didHead});
        }
        return this.didHead;
    }

    @DiscoverConsulDriver.FieldExist
    async createServiceDID(base: number = 10) {
        return this.didGenerator.update(await this.createServiceDIDHeader(), base);
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
        const service = this.consul.agent.service;
        return await promisify(service.register.bind(service))(opts).catch((ex: Error) => {
            this.log.error(`register driver discover/consul failed : ${ex}, ${ex.stack}`);
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
        const service = this.consul.agent.service;
        return await promisify(service.deregister.bind(service))(serviceId).catch((ex: Error) => {
            // this.log.error(`deregister driver discover/consul failed : ${ex}`);
            if (!this.conf.optional) {
                throw ex;
            }
        });
    }

    // @DiscoverConsulDriver.FieldExist
    async httpClient(serviceName: string) {

        return await this.httpClientCache.getLoosingCache(
            serviceName,
            async (name) => {
                let ret;
                if (this.consul) {
                    const services = await this.serviceNodes(name, true);
                    if (services.length > 0) {
                        const service = services[Math.floor(services.length * Math.random())];
                        ret = createHttpClient(`http://${service.address}:${service.port}`);
                    }
                }

                if (!ret) {
                    let fallBackUrl = this.conf.request_fallback[serviceName] && this.conf.request_fallback[serviceName].http;
                    if (fallBackUrl) {
                        this.log.warn(`discover/consul: httpClient of service ${serviceName} fallback to ${fallBackUrl}`);
                        ret = createHttpClient(fallBackUrl);
                    }
                }

                return ret;
            },
            5);
    }

    @DiscoverConsulDriver.FieldExist
    async serviceNodes(serviceName: string, onlyHealthy: boolean = false): Promise<IServiceNode[]> {
        let result: IServiceNode[] = await this.servicesCache.getLoosingCache(
            serviceName,
            async (name): Promise<IServiceNode[]> => {
                const health = this.consul.health; // this.consul.health.service
                const healthNodes: any = await promisify(health.service.bind(health))(name);
                return healthNodes.map((h: any) => {
                    const {ID, Address, Port} = h.Service;
                    return {
                        id: ID, address: Address, port: Port,
                        healthy: (h.Checks as any[]).findIndex((c: any) => c.Status !== "passing") < 0
                    };
                }).filter((c: any) => c);
            }, 2); // refresh cache every second, racing may happen, delay can be up to 2 + ttl
        // console.log("serviceNodes", result);
        return onlyHealthy ? result.filter(n => n.healthy) : result;
    }

    @DiscoverConsulDriver.FieldExist
    async getServiceNames() {
        const cat = this.consul.catalog;
        const services = await promisify(cat.services.bind(cat))();
        return Object.keys(services);
    }

    @DiscoverConsulDriver.FieldExist
    async getServices(): Promise<{ [serviceName: string]: IServiceNode[] }> {
        const serviceNames = await this.getServiceNames();
        const ret: { [serviceName: string]: IServiceNode[] } = {};
        await Promise.all(
            serviceNames.map((sn) =>
                (async () => {
                    ret[sn] = await this.serviceNodes(sn, false);
                })()
            )
        );
        return ret;
    }

    @DiscoverConsulDriver.FieldExist
    async getSelf(): Promise<IServiceNode | undefined> {
        const services = await this.serviceNodes(turtle.conf.name, false);
        return services.find(t => t.id === this.id);
    }


    @DiscoverConsulDriver.FieldExist
    async getStatusSelf(): Promise<NodeStatus> {
        const service = await this.getSelf();
        if (!service) {
            return NodeStatus.NOTEXIST;
        } else if (service.healthy) {
            return NodeStatus.HEALTHY;
        } else if (service.address === turtle.runtime.ip && service.port === turtle.runtime.port) {
            return NodeStatus.UNHEALTHY_ME;
        } else {
            return NodeStatus.UNHEALTHY_OTHER;
        }
    }

}



