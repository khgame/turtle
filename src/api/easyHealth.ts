import {APIRunningState, IApi, turtle} from "../index";
import {createServer, IncomingMessage, ServerResponse} from "http";

export class EasyHealth implements IApi {

    enabled: boolean;
    runningRequest: number;
    runningState: APIRunningState;

    constructor(public readonly fnGetHealthState?: () => Promise<any>, public readonly api = "api/health") {
        this.runningState = APIRunningState.PREPARED;
    }

    async close(): Promise<boolean> {
        this.runningState = APIRunningState.CLOSING;
        console.log(`closed`);
        this.runningState = APIRunningState.CLOSED;
        return true;
    }

    public listen(port?: number): any {
        const server = createServer(this.callback());
        port = port || 8001;
        const ret = server.listen(port);
        // console.log(`start listen at http://localhost:${port}`);
        return ret;
    }

    callback() {
        return (request: IncomingMessage, response: ServerResponse) => {
            if (request.method !== "GET") {
                response.writeHead(405);
                response.end();
                return;
            }

            let content = "";
            request.setEncoding("utf8");
            // console.log(request.url);
            request.on("data", function (chunk: string) {
                content += chunk;
            });
            request.on("end", async () => {
                if (request.url !== "/" + this.api) {
                    response.writeHead(404);
                    response.end();
                    return;
                }
                const retVal = {
                    runtime: turtle.runtime,
                    node_env: process.env.NODE_ENV || "__UNDEFINED__(development)",
                    version: process.env.npm_package_version,
                    conf: turtle.conf,
                    payload: ""
                };

                try {
                    retVal.payload = this.fnGetHealthState ? await this.fnGetHealthState() : "__UNDEFINED__";
                } catch (e) {
                    retVal.payload = `__ERROR__ (${e.message}) : ${e.stack}`;
                }
                const data = JSON.stringify(retVal, null, 4);

                response.writeHead(200, {"Content-Type": "text/json", "Content-Length": data.length});
                response.write(data);
                response.end();
            });
        };
    }

    async start(port: number): Promise<boolean> {
        this.runningState = APIRunningState.STARTING;
        this.listen(port);
        this.runningState = APIRunningState.RUNNING;
        return true;
    }

    static async TurtleFastRun(
        name: string,
        port: number | number[],
        fnGetHealthState?: () => Promise<any>,
        id: number | string | Buffer = 0,
        healthApi: string = "api/health") {
        turtle.conf = {
            name,
            id,
            port,
            drivers: {
                "discover/consul": {
                    health: {
                        api: healthApi
                    }
                }
            }
        };
        await turtle.initialDrivers(["discover/consul"]);
        await turtle.startAll(new EasyHealth(fnGetHealthState, healthApi));
    }
}
