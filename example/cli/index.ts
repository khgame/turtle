import {CommandLineApp} from "../../src/cli/app";
import {APIRunningState, IApi} from "../../src";

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

const cli = new CommandLineApp("example", "0.0.1", [], [new ApiClass()], {
        "name": "example",
        "id": 0,
        "port": 8080,
        "drivers": {
        },
        "rules": {
        }
    }
);

cli.run();
