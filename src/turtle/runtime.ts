import * as getPort from "get-port";
import * as ip from "ip";
import {Server} from "@khgame/jsonrpc/lib";
import {CommandsAPI} from "./commands";
import * as path from "path";
import {turtle} from "./index";
import * as fs from "fs-extra";
import {turtleVerbose} from "../core/utils/turtleVerbose";
import {http} from "../utils";

export class Runtime {

    public turtle_cli_version = 1; // for tools usage

    // env
    public cwd: string;
    public node_env: string;
    public pkg_version: string;
    public in_dev: boolean;

    // process info
    public ip: string;
    public ip_public: string;
    public pid: number;

    // static info
    public name: string;
    public id: string | number | Buffer;
    public service_id: string;

    // runtime info
    public init_time: Date;
    public cmd_port: number;
    public port: number;
    public start_cmd: string[];

    // todo: enabled status
    // todo: worker status
    // todo: api status

    constructor() {
        this.initEnvInfo();
        this.initProcessInfo();
        this.initRuntimeInfo();
    }

    protected initEnvInfo() {
        this.cwd = process.cwd();
        this.node_env = process.env.NODE_ENV;
        this.pkg_version = process.env.npm_package_version;
        this.in_dev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
    }

    protected initProcessInfo() {
        this.ip = ip.address();

        this.pid = process.pid;
    }

    protected initRuntimeInfo() {
        this.init_time = new Date();
        this.start_cmd = process.argv;
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
        const result: any = await http().get("https://api.ipify.org/").catch(() => {
        });
        if (result.status === 200) {
            this.ip_public = result.data;
        }

    }

    setPort(port: number) {
        this.port = port;
        this.initProcessInfo();
        this.save();
    }

    save() {
        this.name = turtle.conf.name;
        this.id = turtle.conf.id;
        this.service_id = turtle.serviceId;
        const p = path.resolve(process.cwd(), `.${turtle.conf.name}-${turtle.conf.id}.turtle`);
        // fs.writeFileSync(p, JSON.stringify({ ... this }, null, 2));
        fs.writeFileSync(p, JSON.stringify({... this, service_id: turtle.serviceId}, null, 2));
        turtleVerbose("RUNTIME SAVED");
    }
}
