import * as getPort from "get-port";
import * as ip from "ip";
import {Server} from "@khgame/jsonrpc/lib";
import {CommandsAPI} from "./commands";
import * as path from "path";
import {turtle} from "./index";
import * as fs from "fs-extra";
import {turtleVerbose} from "../core/utils/turtleVerbose";

export class Runtime {
    public port: number;
    public cmd_port: number;
    public ip: string;
    public pid: number;
    public cwd: string;
    public node_env: string;
    public pkg_version: string;
    public in_dev: boolean;

    constructor(){
        this.initProcessInfo();
    }

    initProcessInfo() {
        this.in_dev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
        this.ip = ip.address();
        this.pid = process.pid;
        this.cwd = process.cwd();
        this.node_env = process.env.NODE_ENV;
        this.pkg_version = process.env.npm_package_version;
    }

    async listenCommands() {
        const port = await getPort({port: getPort.makeRange(13000, 13100)});
        const server = new Server();
        server.init([CommandsAPI]);
        server.listen(port);
        const url = `${ip.address()}:${port}`;
        const target = server.getTarget(CommandsAPI);
        turtleVerbose("CLI INITIALED", `serve at: http://${url}`);

        this.cmd_port = port;
    }

    setPort(port: number){
        this.port = port;
        this.initProcessInfo();
        this.save();
    }

    save(){
        const p = path.resolve(process.cwd(), `.${turtle.conf.name}-${turtle.conf.id}.turtle`);
        fs.writeFileSync(p, JSON.stringify({ ... this, service_id: turtle.serviceId}, null, 2));
        turtleVerbose("RUNTIME SAVED");
    }
}
