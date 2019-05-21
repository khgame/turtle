import * as fs from "fs-extra";
import * as Path from "path";
import {InitDrivers} from "../core";
import {IConf} from "../conf/interfece";
import {EventEmitter} from "events";
import {APIRunningState, IApi} from "../api";
import {exitLog, genLogger, Logger} from "../utils";
import {timeoutPromise} from "kht/lib";

export class Turtle<IDrivers> {

    protected get log(): Logger {
        if (this._log) {
            return this._log;
        }
        return this._log = genLogger();
    }

    protected _log: Logger;

    public conf: IConf;

    public rules<TRules>(): TRules {
        return this.conf.rules as TRules;
    }

    public confPath: any;

    public apis: IApi[];

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

    public loadConf(path?: string) {
        if (!path) {
            throw new Error(`given path(${path}) doesn't exist`);
        }
        path = path || this.confPath;
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
        const results = await InitDrivers(this.conf.drivers, drivers, cb);
        this._drivers = this._drivers ? {...this._drivers, ...results} : results; // override
        console.log("\nDRIVERS INITIALED\n");
    }

    public async startAll(apis: IApi[]) {
        this.apis = apis;

        let ports: number[];
        if (turtle.conf.port instanceof Array) {
            ports = turtle.conf.port;
        } else {
            ports = [turtle.conf.port];
        }

        for (const i in this.apis) {
            if (!ports[i]) {
                throw new Error(`api ${i} are not given ports`);
            }

            const api = this.apis[i];
            switch (api.runningState) {
                case APIRunningState.NONE:
                    throw new Error(`api ${i} hasn't prepared, cannot be start.`);
                case APIRunningState.PREPARED:
                    if (await api.start(ports[i])) {
                        this.log.info(`api ${i} started.`);
                    } else {
                        this.log.error(`api ${i} cannot be start.`);
                    }
                    break;
                case APIRunningState.STARTING:
                    this.log.warn(`api ${i} is in starting procedure, nothing changed.`);
                    break;
                case APIRunningState.RUNNING:
                    this.log.warn(`api ${i} is already in running procedure, nothing changed.`);
                    break;
                case APIRunningState.CLOSING:
                    this.log.warn(`api ${i} is in closing procedure, nothing changed.`);
                    break;
                case APIRunningState.CLOSED:
                    this.log.info(`api ${i} is already closed, try restart.`);
                    if (await api.start(ports[i])) {
                        this.log.info(`api ${i} restarted.`);
                    } else {
                        this.log.warn(`api ${i} restart failed, is it restartable ?`);
                    }
                    break;
                default:
                    throw new Error("unknown running state code.");
            }
        }

        const exit = async (sig: any) => {
            this.log.info(`★★ SIG ${sig} received, please hold ★★`);
            await this.closeAll();
            this.log.info(`★★ process exited ★★`);
            await timeoutPromise(3000, exitLog());
            process.exit(0);
        };

        process.on("SIGTERM", () => exit("SIGTERM"));
        process.on("SIGINT", () => exit("SIGINT"));
    }

    public async closeAll() {
        for (const i in this.apis) {
            const api = this.apis[i];
            switch (api.runningState) {
                case APIRunningState.NONE:
                    throw new Error(`api ${i} hasn't prepared, cannot be stop.`);
                case APIRunningState.PREPARED:
                    this.log.warn(`api ${i} is in prepared but not running, nothing changed.`);
                    break;
                case APIRunningState.STARTING:
                    if (await api.close()) {
                        this.log.info(`api ${i} is closed at starting procedure.`);
                    } else {
                        this.log.warn(`close api ${i} in starting procedure failed.`);
                    }
                    break;
                case APIRunningState.RUNNING:
                    if (await api.close()) {
                        this.log.info(`api ${i} is closed at running procedure.`);
                    } else {
                        this.log.error(`close api ${i} in running procedure failed.`);
                    }
                    break;
                case APIRunningState.CLOSING:
                    this.log.warn(`api ${i} is already at closing procedure, nothing changed.`);
                    break;
                case APIRunningState.CLOSED:
                    this.log.info(`api ${i} is already closed, nothing changed.`);
                    break;
                default:
                    throw new Error("unknown running state code.");
            }
        }
    }
}

export const turtle = new Turtle<any>();

