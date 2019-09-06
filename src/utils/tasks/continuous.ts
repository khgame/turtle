import {forMs} from "kht";

export type TaskHandler = (fireDate: Date, enabled?: () => boolean) => void;

export class Continuous {

    enabled = true;

    cancel() {
        this.enabled = false;
    }

    constructor(
        public taskHandler: TaskHandler,
        public sleepMS: number,
        public errorCrush: boolean = true,
        public onError?: (error: Error) => any,
        public onExit?: (enabled: boolean) => any
    ) {
        this.exec().then();
    }

    async exec() {

        while (this.enabled) {
            try {
                await forMs(100 * Math.random());
                await Promise.resolve(this.taskHandler(new Date(), () => this.enabled));
                await forMs(this.sleepMS);
            } catch (ex) {
                if (this.onError) {
                    this.onError(ex);
                }
                if (this.errorCrush) {
                    break;
                }
            }
        }

        this.onExit(this.enabled);
    }

    static create(
        taskHandler: TaskHandler,
        sleepMS: number,
        errorCrush: boolean = true,
        onError?: (error: Error) => any,
        onExit?: (enabled: boolean) => any
    ) {
        return new Continuous(taskHandler, sleepMS, errorCrush, onError, onExit);
    }
}
