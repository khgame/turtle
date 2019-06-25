import * as fs from "fs-extra";
import * as Path from "path";

import {IConf, ISetting} from "../conf/interface";
import {EventEmitter} from "events";
import {IApi, APIRunningState} from "../core/api";
import {exitLog, genLogger, Logger} from "../utils";
import {timeoutPromise} from "kht/lib";
import * as getPort from "get-port";
import {Runtime} from "./runtime";

import {driverFactory} from "../core/driver/driverFactory";
import {IWorker, WorkerRunningState} from "../core/worker";
export class Turtle<IDrivers> {

    protected initialed: boolean;

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

    get serviceId() {
        return `${this.conf.name}:${this.conf.id}`;
    }

    constructor(){
        console.log(`
    ██████  ██  ██  ██████  ██████  ██      ██████
      ██    ██  ██  ██  ██    ██    ██      ██    
      ██    ██  ██  ████      ██    ██      ██████
      ██    ██  ██  ██  ██    ██    ██      ██
      ██    ██████  ██  ██    ██    ██████  ██████ @khgame
      
   ┌──────────────────────────────────────────────────────┐
   │ - github - https://github.com/khgame/turtle          │ 
   │ - npm - https://www.npmjs.com/package/@khgame/turtle │ 
   └──────────────────────────────────────────────────────┘
`);
    }

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
    }

    public async reload(sig?: string) {
        if (sig) {
            this.log.info(`★★ SIG ${sig} received, please hold ★★`);
        }else {
            this.log.info(`★★ internal hup command received, please hold ★★`);
        }
        this.reloadConf();
        await driverFactory.reloadAll(this.conf.drivers);
    }

    public async shutdown(sig?: string) {
        try {
            if (sig) {
                this.log.info(`★★ SIG ${sig} received, please hold ★★`);
            } else {
                this.log.info(`★★ internal shutdown command received, please hold ★★`);
            }
            await this.closeAll();
            this.log.info(`★★ process exited ★★`);
            await timeoutPromise(5000, exitLog());
            process.exit(0);
        } catch (err) {
            process.exit(1);
        }
    }

    protected async tryInitial() {
        if (this.initialed) {
            return;
        }

        process.on("SIGTERM", () => this.shutdown("SIGTERM"));
        process.on("SIGINT", () => this.shutdown("SIGINT"));
        process.on("SIGHUP", () => this.reload("SIGHUP"));
        await this.runtime.listenCommands();
        this.initialed = true;

        turtleVerbose(`PROCESS INITIALED (pid: ${turtle.runtime.pid})`,
            `cwd: ${turtle.runtime.cwd}`,
            `env: ${turtle.runtime.node_env}`,
        );
    }

    /**
     * start the api
     * @desc to start the api, the running state must be PREPARED|CLOSED, otherwise nothing will happen.
     *       in the error situation (close failed or in wrong state), an Error will be thrown.
     * @return {Promise<void>}
     */
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
        this.runtime.setPort(port);
        this.api = api;
        await driverFactory.triggerApiStart();

        turtleVerbose("API STARTED", `serve at: http://${turtle.runtime.ip}:${turtle.runtime.port}`);
    }

    protected async startWorkers(workers: IWorker[]) {
        if (!this.workers) {
            this.log.info(`there are no workers to start.`);
            return;
        }
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
        //         case ProcessRunningState.NONE:
        //             throw new Error(`api ${i} hasn't prepared, cannot be start.`);
        //         case ProcessRunningState.PREPARED:
        //             if (await api.start(ports[i])) {
        //                 this.log.info(`api ${i} started.`);
        //             } else {
        //                 this.log.error(`api ${i} cannot be start.`);
        //             }
        //             break;
        //         case ProcessRunningState.STARTING:
        //             this.log.warn(`api ${i} is in starting procedure, nothing changed.`);
        //             break;
        //         case ProcessRunningState.RUNNING:
        //             this.log.warn(`api ${i} is already in running procedure, nothing changed.`);
        //             break;
        //         case ProcessRunningState.CLOSING:
        //             this.log.warn(`api ${i} is in closing procedure, nothing changed.`);
        //             break;
        //         case ProcessRunningState.CLOSED:
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


        turtleVerbose("WORKERS STARTED");
    }

    public async startAll(api: IApi, workers?: IWorker[]) {
        await this.tryInitial();
        await this.startApi(api);
        await this.startWorkers(workers);
    }


    /**
     * close the api
     * @desc to close the api, the running state must be STARTING|RUNNING, otherwise nothing will happen.
     *       in the error situation (close failed or in wrong state), an Error will be thrown.
     * @return {Promise<void>}
     */
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

        turtleVerbose("API CLOSED");
    }

    public async closeWorker() {
        if (!this.workers) {
            this.log.info(`there are no workers to close.`);
            return;
        }
        for (const i in this.workers) {
            const worker = this.workers[i];
            switch (worker.runningState) {
                case WorkerRunningState.NONE:
                    throw new Error(`worker ${i} hasn't prepared, cannot be stop.`);
                case WorkerRunningState.PREPARED:
                    this.log.warn(`worker ${i} is in prepared but not running, nothing changed.`);
                    break;
                case WorkerRunningState.STARTING:
                    if (await worker.close()) {
                        this.log.info(`worker ${i} is closed at starting procedure.`);
                    } else {
                        this.log.warn(`close worker ${i} in starting procedure failed.`);
                    }
                    break;
                case WorkerRunningState.RUNNING:
                    if (await worker.close()) {
                        this.log.info(`worker ${i} is closed at running procedure.`);
                    } else {
                        this.log.error(`close worker ${i} in running procedure failed.`);
                    }
                    break;
                case WorkerRunningState.CLOSING:
                    this.log.warn(`worker ${i} is already at closing procedure, nothing changed.`);
                    break;
                case WorkerRunningState.CLOSED:
                    this.log.info(`worker ${i} is already closed, nothing changed.`);
                    break;
                default:
                    throw new Error("unknown running state code.");
            }
        }
        await driverFactory.triggerWorkerClose();

        turtleVerbose("API CLOSED");
    }

    public async closeAll() {
        await this.closeWorker();
        await this.closeApi();
    }
}

import {turtleVerbose} from "../core/utils/turtleVerbose";

export const turtle = new Turtle<any>();
