import {genLogger} from "../../utils";
import {IWorker, WorkerRunningState} from "./interface";
import {Logger} from "winston";

export * from "./interface";

export abstract class Worker implements IWorker {
    enabled: boolean;
    runningState: WorkerRunningState = WorkerRunningState.NONE;

    public static workerMap: { [key: string]: IWorker } = {};

    public log: Logger;

    public constructor(public readonly name: string) {
        if (Worker.workerMap[name]) {
            throw new Error(`worker ${name} are already exist.`);
        }
        Worker.workerMap[name] = this;
        this.log = genLogger("worker:" + name);
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

    async close(): Promise<boolean> {
        this.log.info("※※ start shutdown worker ※※");
        this.runningState = WorkerRunningState.CLOSING;
        try {
            this.enabled = false;
            this.log.info("- close worker ✓");
            if (await this.onClose()) {
                this.log.info("※※ application exited ※※");
                this.log.close();
                this.runningState = WorkerRunningState.RUNNING;
                return true;
            } else {
                this.runningState = WorkerRunningState.CLOSED;
                return false;
            }
        } catch (e) {
            this.log.error(`※※ shutdown application failed ※※ ${e}`);
            this.runningState = WorkerRunningState.RUNNING;
            return false;
        }
    }

    public abstract onClose(): Promise<boolean> ;

    public abstract onStart(): Promise<boolean> ;
}
