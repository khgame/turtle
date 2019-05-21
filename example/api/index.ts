import {APIRunningState, IApi, turtle} from "../../src/";
import * as Path from "path";

/** ApiClass is an implementation of IApi */
class ApiClass implements IApi {

    enabled: boolean;
    runningRequest: number;
    runningState: APIRunningState;

    constructor() {
        this.runningState = APIRunningState.PREPARED;
    }

    async close(): Promise<boolean> {
        this.runningState = APIRunningState.CLOSING;
        console.log(`closed`);
        this.runningState = APIRunningState.CLOSED;
        return true;
    }

    async start(port: number): Promise<boolean> {
        this.runningState = APIRunningState.STARTING;
        console.log(`listen to ${port}`);
        this.runningState = APIRunningState.RUNNING;
        return true;
    }
}

async function start() {
    /** 1. set config to turtle */
    turtle.setConf(Path.resolve(__dirname, `./config.${process.env.NODE_ENV || "development"}.json`), false);
    /** 2. create the api instance (or instances) */
    const api = new ApiClass();
    // await turtle.initialDrivers([]); // initial drivers if needed
    /** 3. put the api instance to turtle.startAll */
    await turtle.startAll([api]);
    setInterval(() => console.log("update " + Date.now()), 5000);
}

start().then(() => {
    console.log("service started");
});

