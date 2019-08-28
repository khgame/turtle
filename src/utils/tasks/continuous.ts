import {forMs} from "kht";

export type TaskHandler = (fireDate: Date, enabled?: () => boolean) => void;

export class Continuous {

    enabled = true;

    cancel() {
        this.enabled = false;
    }

    constructor(
        public cb: TaskHandler,
        public sleepMS: number
    ) {
        this.exec().then();
    }

    async exec() {
        while (this.enabled) {
            await forMs(100 * Math.random());
            await Promise.resolve(this.cb(new Date(), () => this.enabled));
            await forMs(this.sleepMS);
        }
    }

    static create(cb: TaskHandler, sleepMS: number) {
        return new Continuous(cb, sleepMS);
    }
}
