import {genLogger} from "../../utils";
import {IWorker, WorkerRunningState} from "./interface";
import {Logger} from "winston";

export * from "./interface";

export abstract class Worker implements IWorker {
    enabled: boolean;
    runningState: WorkerRunningState;

    public log: Logger;

    public constructor(public readonly name: string) {
        this.log = genLogger("worker:" + name);
    }

    public async start(): Promise<boolean> {
        this.log.info(`※※ Starting Process ※※`);
        this.runningState = WorkerRunningState.STARTING;
        try {
            if (await this.onStart()) {
                this.log.info(`※※ All Process Started ※※`);
                this.runningState = WorkerRunningState.CLOSED;
                this.enabled = true;
                return true;
            } else {
                this.log.info(`※※ All Worker Started ※※`);
                this.runningState = WorkerRunningState.RUNNING;
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
            await this.onClose();
            this.log.info("※※ application exited ※※");
            this.log.close();
            this.runningState = WorkerRunningState.CLOSED;
            return true;
        } catch (e) {
            this.log.error(`※※ shutdown application failed ※※ ${e}`);
            this.runningState = WorkerRunningState.RUNNING;
            return false;
        }
    }

    public abstract onClose(): Promise<boolean> ;
    public abstract onStart(): Promise<boolean> ;
}
