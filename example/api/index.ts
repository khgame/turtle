import {APIRunningState, CError, genAssert, genLogger, IApi, turtle} from "../../src/";
import * as Path from "path";
import chalk from "chalk";

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
    console.log(process.argv);
    console.log(process.config);
    /** 3. put the api instance to turtle.startAll */
    await turtle.startAll(api);
    setInterval(() =>
            console.log(
                chalk.rgb(255 * Math.random(), 255 * Math.random(), 255 * Math.random())("update " + Date.now())
            )
        , 1000
    );
}

start().then(() => {
    console.log("service started");

    let assert = genAssert("ep-api");
    let log = genLogger("ep-api");

    log.info("test log");
    console.log("test console.log");


    try {
        assert.cok(false, 123, () => "test assert cok");
    } catch (ex) {
        console.log((ex as CError).code);
        console.log((ex as CError).message);
        console.log((ex as CError).name);
    }

});

