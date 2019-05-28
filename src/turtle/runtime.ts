import * as getPort from "get-port";
import * as ip from "ip";
import {Server} from "@khgame/jsonrpc/lib";
import {CommandsAPI} from "./commands";

export class Runtime {
    public port: number;
    public cmd_port: number;
    public ip: string;
    public pid: number;
    public cwd: string;

    async listenCommands() {
        const port = await getPort({port: getPort.makeRange(13000, 13100)});
        const server = new Server();
        server.init([CommandsAPI]);
        server.listen(port);
        const url = `${ip.address()}:${port}`;
        const target = server.getTarget(CommandsAPI);
        console.log(`start commands server at ${url}, targets => ${target}`);

        this.cmd_port = port;
    }

    setProcessInfo(port: number){
        this.ip = ip.address();
        this.port = port;
        this.pid = process.pid;
        this.cwd = process.cwd();
    }
}
