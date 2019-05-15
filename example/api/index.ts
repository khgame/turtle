import {APIRunningState, IApi, turtle} from "../../src/";
import * as Path from "path";

class Application implements IApi {

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
    turtle.setConf(Path.resolve(__dirname, `./config.${process.env.NODE_ENV || "development"}.json`), false);
    const app = new Application();
    await turtle.initialDrivers([]);
    await turtle.startAll([app]);

    const exit = async () => {
        console.log("\n★★ SIGINT received, please hold ★★");
        await turtle.closeAll();
        console.log("\n★★ process exited ★★");
        process.exit(0);
    };

    process.on("SIGTERM", exit);
    process.on("SIGINT", exit);

    setInterval(() => console.log("update " + Date.now()), 5000);
}

start().then(() => {
    console.log("service started");
});

