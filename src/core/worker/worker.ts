import {genAssert, genLogger} from "../../utils";
import {IWorker, WorkerRunningState} from "./interface";
import {Logger} from "winston";
import {forCondition, timeoutPromise} from "kht";
import {turtle} from "../../turtle";
import {CAssert, CError} from "@khgame/err";

export abstract class Worker implements IWorker {

    enabled: boolean = false;

    processRunning: number = 0;

    get canBeShutdown(): boolean {
        return this.processRunning <= 0;
    }

    runningState: WorkerRunningState = WorkerRunningState.NONE;

    public static workerMap: { [key: string]: IWorker } = {};

    public get log(): Logger {
        if (!this.name) {
            throw Error("name of the worker are not exist");
        }
        return this.__log = genLogger("worker:" + this.name);
    }
    private __log: Logger;

    public get assert(): CAssert {
        if (!this.name) {
            throw Error("name of the worker are not exist");
        }
        return this.__assert = genAssert("worker:" + this.name);
    }
    private __assert: CAssert;

    constructor(public readonly name: string) {
        if (Worker.workerMap[name]) {
            throw new Error(`worker ${name} are already exist.`);
        }
        Worker.workerMap[name] = this;
    }

    public async start(): Promise<boolean> {
        this.log.info(`※※ Starting Process ※※`);
        this.runningState = WorkerRunningState.STARTING;
        try {
            if (await this.onStart()) {
                this.log.info(`※※ All Process Started ※※`);
                this.runningState = WorkerRunningState.RUNNING;
                this.enabled = true;
                return true;
            } else {
                this.log.info(`※※ All Worker Started ※※`);
                this.runningState = WorkerRunningState.CLOSED;
                return false;
            }
        } catch (e) {
            this.log.error(`※※ Start Process Failed ※※ ${e}`);
            this.runningState = WorkerRunningState.PREPARED;
            return false;
        }
    }

    async shutdown(): Promise<boolean> {

        this.log.info("※※ start shutdown worker ※※");
        this.runningState = WorkerRunningState.CLOSING;
        try {
            this.enabled = false;
            this.log.info(`- disable worker ${this.name} ✓`);
            await timeoutPromise(turtle.conf.setting.worker_close_timeout_ms || 300000, forCondition(() => this.processRunning <= 0));
            // todo: should timeout?
            this.log.info(`- all running process of worker ${this.name} are closed ✓`);
            this.log.info(`※※ worker ${this.name} exited ※※`);
            return true;
        } catch (e) {
            this.log.error(`※※ shutdown worker ${this.name} failed ※※ ${e}`);
            this.runningState = WorkerRunningState.RUNNING;
            return false;
        }
    }

    public abstract onStart(): Promise<boolean> ;
}
