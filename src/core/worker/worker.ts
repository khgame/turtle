import {genAssert, genLogger, Continuous} from "../../utils";
import {IWorker, WorkerRunningState} from "./interface";
import {Logger} from "winston";
import {forCondition, timeoutPromise} from "kht";
import {turtle} from "../../turtle";
import {CAssert} from "@khgame/err";
import {Job} from "node-schedule";

let schedule: any;
if (require) {
    try {
        schedule = require("node-schedule");
    } catch (e) {
    }
}

export type WorkerTaskCallback = ((date: Date, isEnabled: () => boolean) => any) | ((date: Date) => any) | (() => any);

export abstract class Worker implements IWorker { // todo: inject decorators

    public static workerMap: { [key: string]: IWorker } = {}; // todo: check all worker status

    enabled: boolean = false;

    processRunning: number = 0;

    get canBeShutdown(): boolean {
        return this.processRunning <= 0;
    }

    runningState: WorkerRunningState = WorkerRunningState.NONE;

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

        /** !!! child classes should set runningState to WorkerRunningState.RUNNING in their constructor */
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
            throw e;
        }
    }

    async shutdown(): Promise<boolean> {

        this.log.info("※※ start shutdown worker ※※");
        this.runningState = WorkerRunningState.CLOSING;
        try {
            this.enabled = false;
            this.log.info(`- disable worker ${this.name} ✓`);

            for (const indCW in this._allWorks) {
                this._allWorks[indCW].cancel();
            }
            this.log.info(`- cancel all continuous works of worker ${this.name} (${this._allJobs.length}) ✓`);

            for (const indCW in this._allJobs) {
                this._allJobs[indCW].cancel();
            }
            this.log.info(`- cancel all scheduler works of worker ${this.name} (${this._allJobs.length}) ✓`);

            const workerCloseTimeout = turtle.conf.setting.worker_close_timeout_ms === undefined ? 30000 : turtle.conf.setting.worker_close_timeout_ms; // todo: should timeout?
            /**  -1 means wail until, 0 means right now */
            if (workerCloseTimeout < 0) {
                await forCondition(() => this.processRunning <= 0);
            } else if (workerCloseTimeout > 0) {
                await timeoutPromise(workerCloseTimeout, forCondition(() => this.processRunning <= 0));
            }

            this.log.info(`- all running process of worker ${this.name} are closed ✓`);
            this.log.info(`※※ worker ${this.name} exited ※※`);
            return true;
        } catch (e) {
            this.log.error(`※※ shutdown worker ${this.name} failed ※※ processRunning : ${this.processRunning}, ${e}`);
            this.runningState = WorkerRunningState.RUNNING;
            return false;
        }
    }

    public abstract onStart(): Promise<boolean> ;

    protected _allWorks: Array<Job | Continuous> = [];
    protected _allJobs: Array<Job | Continuous> = [];

    public createContinuousWork(
        cb: WorkerTaskCallback,
        spanMS: number = 1000,
        log: string,
        errorCrush: boolean = true
    ): Continuous {
        this.assert.ok(cb, `create continuous work (span ${spanMS}) of ${this.name} failed, callback must exist`);
        const taskHandler = this.packMethodToWork("continuous", cb, log);
        const task: Continuous = Continuous.create(
            taskHandler,
            spanMS,
            errorCrush,
            (error) => {
                this.log.error(`uncaught error in continuous work ${log}: ${error}. ${error.stack}.`);
            },
            (enabled: boolean) => {
                this.log.info(`continuous work ${log} exited when enabled : ${enabled}.`);
            });
        this._allWorks.push(task);
        return task;
    }

    public createSchedulerWork(cron: string, cb: WorkerTaskCallback, log?: string): Job {
        if (!schedule) {
            throw new Error("node-schedule package was not found installed. Try to install it: npm install node-schedule --save");
        }
        this.assert.ok(cb, `create scheduler work of ${this.name} failed, callback must exist`);
        const taskHandler = this.packMethodToWork("scheduler", cb, log);
        const task: Job = schedule.scheduleJob(cron, taskHandler);
        this._allJobs.push(task);
        return task;
    }

    protected packMethodToWork(type: string, cb: WorkerTaskCallback, log?: string): WorkerTaskCallback { // this.processRunning can only be used in the instance itself
        let round = 1;
        const handler = async (date: Date, isEnabled: () => boolean) => {
            this.processRunning += 1;
            try {
                if (log) {
                    this.log.info(`worker: ${type} work ${log} of ${this.name} executed, round ${round}`);
                }
                await Promise.resolve(cb(date, isEnabled));
            } catch (e) {
                this.log.warn(`worker: ${type} work ${log} of ${this.name} failed, round ${round} error: ${e}, ${e.stack}`);
                throw e;
            } finally {
                this.processRunning -= 1;
                round++;
            }
        };
        return handler.bind(this);
    }
}
