import * as getPort from "get-port";
import * as ip from "ip";
import {Server} from "@khgame/jsonrpc/lib";
import {CommandsAPI} from "./commands";
import * as path from "path";
import {turtle} from "./index";
import * as fs from "fs-extra";

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
        this.save();
    }

    setProcessInfo(port: number){
        this.ip = ip.address();
        this.port = port;
        this.pid = process.pid;
        this.cwd = process.cwd();
        this.save();
    }

    save(){
        const p = path.resolve(process.cwd(), `.${turtle.conf.name}-${turtle.conf.id}.turtle`);
        fs.writeFileSync(p, JSON.stringify(this, null, 2));
    }
}
