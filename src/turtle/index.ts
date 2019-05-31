import * as fs from "fs-extra";
import * as Path from "path";

import {IConf, ISetting} from "../conf/interfece";
import {EventEmitter} from "events";
import {APIRunningState, IApi, IWorker} from "../api";
import {exitLog, genLogger, Logger} from "../utils";
import {timeoutPromise} from "kht/lib";
import * as getPort from "get-port";
import {Runtime} from "./runtime";

import {driverFactory} from "../core/driver/driverFactory";

export class Turtle<IDrivers> {

    protected get log(): Logger {
        if (this._log) {
            return this._log;
        }
        return this._log = genLogger();
    }

    protected _log: Logger;

    public runtime: Runtime = new Runtime();

    public conf: IConf;

    public rules<TRules>(): TRules {
        return this.conf.rules as TRules;
    }

    public get setting(): ISetting {
        return this.conf.setting || {};
    }

    public confPath: any;

    public api: IApi;

    public workers: IWorker[];

    public get drivers(): IDrivers {
        return this._drivers as IDrivers;
    }

    public driver<TService>(name?: string) {
        return name ? this._drivers[name] : undefined;
    }

    protected _drivers: { [key: string]: any };

    public setConf(path: string, force: boolean) {
        if (!force && this.conf) {
            return;
        }
        this.loadConf(path);
    }

    public reloadConf() {
        if (!this.confPath) {
            throw new Error(`cannot reload conf cuz the conf path are not set`);
        }
        this.log.info(`config reloaded (${this.confPath}): ${JSON.stringify(this.conf)}`);
        this.loadConf(this.confPath);
    }

    public loadConf(path?: string) {
        if (!path) {
            throw new Error(`cannot reload conf cuz the given path does not exist`);
        }
        path = Path.isAbsolute(path) ? path : Path.resolve(process.cwd(), path);
        if (!fs.existsSync(path)) {
            throw new Error(`conf file at path(${path}) cannot be found`);
        }
        let content = fs.readFileSync(path);
        try {
            this.conf = JSON.parse(content.toString());
        } catch (e) {
            throw new Error(`parse conf file at path(${path}) failed, content: ${content.toString()}`);
        }
        this.confPath = path;
    }

    public async initialDrivers(drivers: Array<string | Function>, cb?: (e: EventEmitter) => void) {
        const results = await driverFactory.initAll(this.conf.drivers, drivers, cb);
        try {
            this._drivers = this._drivers ? {...this._drivers, ...results} : results; // override
        }
        catch (ex) {
            console.error(`INITIAL DRIVERS FAILED, ${ex}`);
            throw ex;
        }
        console.log("DRIVERS INITIALED");
    }

    protected async startApi(api: IApi) {
        let port: number;
        if (!turtle.conf.port) {
            port = await getPort();
        } else {
            let ports: number[] = (typeof turtle.conf.port === "number") ? [turtle.conf.port] : turtle.conf.port;
            port = await getPort({port: ports});
            if (ports.indexOf(port) < 0) {
                throw new Error(`startApi: ports are occupied, ${ports}. avaliable: ${port}`);
            }
        }
        switch (api.runningState) {
            case APIRunningState.NONE:
                throw new Error(`api service hasn't prepared, cannot be start.`);
            case APIRunningState.PREPARED:
                if (await api.start(port)) {
                    this.log.info(`api service started.`);
                } else {
                    this.log.error(`api service cannot be start.`);
                }
                break;
            case APIRunningState.STARTING:
                this.log.warn(`api service is in starting procedure, nothing changed.`);
                break;
            case APIRunningState.RUNNING:
                this.log.warn(`api service is already in running procedure, nothing changed.`);
                break;
            case APIRunningState.CLOSING:
                this.log.warn(`api service is in closing procedure, nothing changed.`);
                break;
            case APIRunningState.CLOSED:
                this.log.info(`api service is already closed, try restart.`);
                if (await api.start(port)) {
                    this.log.info(`api service restarted.`);
                } else {
                    this.log.warn(`api service restart failed, is it restartable ?`);
                }
                break;
            default:
                throw new Error("unknown running state code.");
        }
        this.runtime.setProcessInfo(port);
        this.api = api;
        await driverFactory.triggerApiStart();
    }

    protected async startWorkers(workers: IWorker[]) {
        // todo
        // let ports: number[];
        // if (turtle.conf.port instanceof Array) {
        //     ports = turtle.conf.port;
        // } else {
        //     ports = [turtle.conf.port];
        // }
        //
        // for (const i in this.apis) {
        //     if (!ports[i]) {
        //         throw new Error(`api ${i} are not given ports`);
        //     }
        //
        //     const api = this.apis[i];
        //     switch (api.runningState) {
        //         case APIRunningState.NONE:
        //             throw new Error(`api ${i} hasn't prepared, cannot be start.`);
        //         case APIRunningState.PREPARED:
        //             if (await api.start(ports[i])) {
        //                 this.log.info(`api ${i} started.`);
        //             } else {
        //                 this.log.error(`api ${i} cannot be start.`);
        //             }
        //             break;
        //         case APIRunningState.STARTING:
        //             this.log.warn(`api ${i} is in starting procedure, nothing changed.`);
        //             break;
        //         case APIRunningState.RUNNING:
        //             this.log.warn(`api ${i} is already in running procedure, nothing changed.`);
        //             break;
        //         case APIRunningState.CLOSING:
        //             this.log.warn(`api ${i} is in closing procedure, nothing changed.`);
        //             break;
        //         case APIRunningState.CLOSED:
        //             this.log.info(`api ${i} is already closed, try restart.`);
        //             if (await api.start(ports[i])) {
        //                 this.log.info(`api ${i} restarted.`);
        //             } else {
        //                 this.log.warn(`api ${i} restart failed, is it restartable ?`);
        //             }
        //             break;
        //         default:
        //             throw new Error("unknown running state code.");
        //     }
        // }
        //
    }

    public async startAll(api: IApi, workers?: IWorker[]) {
        await this.startApi(api);
        if (workers) {
            await this.startWorkers(workers);
        }

        const exit = async (sig: any) => {
            this.log.info(`★★ SIG ${sig} received, please hold ★★`);
            await this.closeAll();
            this.log.info(`★★ process exited ★★`);
            await timeoutPromise(5000, exitLog());
            process.exit(0);
        };

        process.on("SIGTERM", () => exit("SIGTERM"));
        process.on("SIGINT", () => exit("SIGINT"));

        await this.runtime.listenCommands();
    }

    public async closeApi() {
        const api = this.api;
        switch (api.runningState) {
            case APIRunningState.NONE:
                throw new Error(`api service hasn't prepared, cannot be stop.`);
            case APIRunningState.PREPARED:
                this.log.warn(`api service is in prepared but not running, nothing changed.`);
                break;
            case APIRunningState.STARTING:
                if (await api.close()) {
                    this.log.info(`api service is closed at starting procedure.`);
                } else {
                    this.log.warn(`close api service in starting procedure failed.`);
                }
                break;
            case APIRunningState.RUNNING:
                if (await api.close()) {
                    this.log.info(`api service is closed at running procedure.`);
                } else {
                    this.log.error(`close api service in running procedure failed.`);
                }
                break;
            case APIRunningState.CLOSING:
                this.log.warn(`api service is already at closing procedure, nothing changed.`);
                break;
            case APIRunningState.CLOSED:
                this.log.info(`api service is already closed, nothing changed.`);
                break;
            default:
                throw new Error("unknown running state code.");
        }
        await driverFactory.triggerApiClose();
    }

    public async closeWorker() {
        if (!this.workers) {
            this.log.info(`there no workers to close.`);
            return;
        }
        for (const i in this.workers) {
            const worker = this.workers[i];
            switch (worker.runningState) {
                case APIRunningState.NONE:
                    throw new Error(`worker ${i} hasn't prepared, cannot be stop.`);
                case APIRunningState.PREPARED:
                    this.log.warn(`worker ${i} is in prepared but not running, nothing changed.`);
                    break;
                case APIRunningState.STARTING:
                    if (await worker.close()) {
                        this.log.info(`worker ${i} is closed at starting procedure.`);
                    } else {
                        this.log.warn(`close worker ${i} in starting procedure failed.`);
                    }
                    break;
                case APIRunningState.RUNNING:
                    if (await worker.close()) {
                        this.log.info(`worker ${i} is closed at running procedure.`);
                    } else {
                        this.log.error(`close worker ${i} in running procedure failed.`);
                    }
                    break;
                case APIRunningState.CLOSING:
                    this.log.warn(`worker ${i} is already at closing procedure, nothing changed.`);
                    break;
                case APIRunningState.CLOSED:
                    this.log.info(`worker ${i} is already closed, nothing changed.`);
                    break;
                default:
                    throw new Error("unknown running state code.");
            }
        }
        await driverFactory.triggerWorkerClose();
    }

    public async closeAll() {
        await this.closeWorker();
        await this.closeApi();
    }
}

export const turtle = new Turtle<any>();
