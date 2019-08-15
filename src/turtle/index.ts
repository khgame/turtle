import * as fs from "fs-extra";
import * as Path from "path";

import {IConf, ISetting} from "../conf/interface";
import {EventEmitter} from "events";
import {IApi, APIRunningState} from "../core/api";
import {CError, exitLog, genLogger, Logger} from "../utils";
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

    public rules<TRules = any>(): TRules {
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

    constructor() {
        console.log(`
    ██████  ██  ██  ██████  ██████  ██      ██████
      ██    ██  ██  ██  ██    ██    ██      ██    
      ██    ██  ██  ████      ██    ██      ██████
      ██    ██  ██  ██  ██    ██    ██      ██
      ██    ██████  ██  ██    ██    ██████  ██████ ` + chalk.grey(`@khgame
      
   ┌──────────────────────────────────────────────────────┐
   │ - github - https://github.com/khgame/turtle          │ 
   │ - npm - https://www.npmjs.com/package/@khgame/turtle │ 
   └──────────────────────────────────────────────────────┘
`));
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
        } else {
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

    protected async tryInitial(cmdControllers: Function[] = []) {

        if (this.initialed) {
            return;
        }

        const oldProcessAlive = this.runtime.checkProcessAlive();

        if (oldProcessAlive) {
            turtleVerbose(`PROCESS COLLISION DETECTED`, `pid: ${oldProcessAlive}`);
            throw new Error(`process of name:${
                this.conf.name} id:${
                this.conf.id} is running (pid:${
                oldProcessAlive}) in current dir (path:${
                this.runtime.runtimeFilePath}) .`);
        }

        await this.runtime.listenCommands(cmdControllers);

        process.on("SIGTERM", () => this.shutdown("SIGTERM"));
        process.on("SIGINT", () => this.shutdown("SIGINT"));
        process.on("SIGHUP", () => this.reload("SIGHUP"));

        this.initialed = true;

        turtleVerbose(`PROCESS INITIALED (pid: ${turtle.runtime.pid})`,
            `cwd: ${turtle.runtime.cwd}`,
            `env: ${turtle.runtime.node_env}`,
        );
    }

    /**
     * start the api
     * @desc to start the api, the running state must be PREPARED|CLOSED, otherwise nothing will happen.
     *       in the error situation (shutdown failed or in wrong state), an Error will be thrown.
     * @return {Promise<void>}
     */
    protected async startApi(api: IApi): Promise<this> {
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

        if (this.api && api !== this.api) {
            this.log.warn(`there are another registered api, nothing will happen.`);
            return this;
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
        return this;
    }

    protected async startWorkers(workers: IWorker[]): Promise<this> {
        if (!workers) {
            this.log.info(`there are no workers to start.`);
            return this;
        }

        this.workers = this.workers || [];
        workers.forEach(w => {
            if (this.workers.indexOf(w) < 0) {
                this.workers.push(w);
            } else {
                this.log.warn(`worker ${w.name} is already in the running list`);
            }
        });

        const started = [];
        const failed = [];
        const error = [];

        for (let i = 0; i < this.workers.length; i++) {
            const worker = this.workers[i];

            switch (worker.runningState) {
                case WorkerRunningState.NONE:
                    throw new Error(`start worker ${i}:${worker.name} failed: it hasn't prepared.`);
                case WorkerRunningState.PREPARED:
                    try {
                        if (await worker.start()) {
                            this.log.info(`worker ${i}:${worker.name} started.`);
                            started.push(worker.name);
                        } else {
                            this.log.error(`worker ${i}:${worker.name} cannot be start.`);
                            failed.push(worker.name);
                        }
                    } catch (e) {
                        this.log.info(`worker ${i}:${worker.name} start error. ${e}`);
                        error.push(worker.name);
                    }
                    break;
                case WorkerRunningState.STARTING:
                    this.log.warn(`worker ${i}:${worker.name} is in starting procedure, nothing changed.`);
                    break;
                case WorkerRunningState.RUNNING:
                    this.log.warn(`worker ${i}:${worker.name} is already in running procedure, nothing changed.`);
                    break;
                case WorkerRunningState.CLOSING:
                    this.log.warn(`worker ${i}:${worker.name} is in closing procedure, nothing changed.`);
                    break;
                case WorkerRunningState.CLOSED:
                    this.log.info(`worker ${i}:${worker.name} is already closed, try restart.`);
                    try {
                        if (await worker.start()) {
                            this.log.info(`worker ${i}:${worker.name} restarted.`);
                            started.push(worker.name);
                        } else {
                            this.log.warn(`worker ${i}:${worker.name} restart failed, is it restartable ?`);
                            failed.push(worker.name);
                        }
                    } catch (e) {
                        this.log.info(`worker ${i}:${worker.name}  start error. ${e}`);
                        error.push(worker.name);
                    }
                    break;
                default:
                    throw new Error(`start worker ${i}:${worker.name} failed: unknown running state code.`);
            }
        }
        const logs = [];
        if (started.length > 0) {
            logs.push(started.reduce((p, n) => p + " " + n, "started:"));
        }
        if (failed.length > 0) {
            logs.push(failed.reduce((p, n) => p + " " + n, "failed:"));
        }
        if (error.length > 0) {
            logs.push(error.reduce((p, n) => p + " " + n, "error:"));
        }
        turtleVerbose("WORKERS STARTED", ...logs);
        return this;
    }

    public async startAll(api: IApi, workers?: IWorker[], cmdControllers?: Function[]) {
        await this.tryInitial(cmdControllers);
        await this.startApi(api);
        await this.startWorkers(workers);
    }


    /**
     * shutdown the api
     * @desc to shutdown the api, the running state must be STARTING|RUNNING, otherwise nothing will happen.
     *       in the error situation (shutdown failed or in wrong state), an Error will be thrown.
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

        const closedWorkerNames: string[] = [];
        for (const i in this.workers) {
            const worker = this.workers[i];
            switch (worker.runningState) {
                case WorkerRunningState.NONE:
                    throw new Error(`worker ${i} hasn't prepared, cannot be stop.`);
                case WorkerRunningState.PREPARED:
                    this.log.warn(`worker ${i} is in prepared but not running, nothing changed.`);
                    break;
                case WorkerRunningState.STARTING:
                    if (await worker.shutdown()) {
                        closedWorkerNames.push(worker.name);
                        this.log.info(`worker ${i} is closed at starting procedure.`);
                    } else {
                        this.log.warn(`close worker ${i} at starting procedure failed.`);
                    }
                    break;
                case WorkerRunningState.RUNNING:
                    if (await worker.shutdown()) {
                        closedWorkerNames.push(worker.name);
                        this.log.info(`worker ${i} is closed at running procedure.`);
                    } else {
                        this.log.error(`close worker ${i} at running procedure failed.`);
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

        turtleVerbose(`WORKERS CLOSED`, ... closedWorkerNames);
    }

    public async closeAll() {
        await this.closeWorker();
        await this.closeApi();
    }
}

import {turtleVerbose} from "../core/utils/turtleVerbose";
import chalk from "chalk";

export const turtle = new Turtle<any>();
