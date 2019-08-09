import * as getPort from "get-port";
import * as ip from "ip";
import {Server} from "@khgame/jsonrpc/lib";
import {CommandsAPI} from "./commands";
import * as path from "path";
import {turtle} from "./index";
import * as fs from "fs-extra";
import {turtleVerbose} from "../core/utils/turtleVerbose";
import * as publicIp from "public-ip";
import chalk from "chalk";
import {http} from "../utils";

export class Runtime {

    public turtle_cli_version = 2; // for tools usage

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

    public npm_lifecycle_script: string;

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
        this.npm_lifecycle_script = process.env.npm_lifecycle_script;
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
        try {
            console.log(chalk.green(`try get public ip`));
            this.ip_public = await publicIp.v4();
        } catch (e) {
            try {
                console.log(chalk.green(`try get public ip 2`));

                const retIp = await Promise.race([
                        "https://ipinfo.io/ip",
                        "https://ip.cn",
                        "http://icanhazip.com/",
                        "http://ident.me/",
                        "http://icanhazip.com/",
                        "http://tnx.nl/ip",
                        "http://ipecho.net/plain",
                        "http://diagnostic.opendns.com/myip",
                    ].map((urlIp: string) => http()
                        .get(urlIp)
                        .then(rsp => {
                            if (rsp.status !== 200) {
                                throw new Error(`rsp status error, expect 200, got ${rsp.status}`);
                            }
                            const rspData = rsp.data || (rsp as any).text;
                            if (!rspData) {
                                throw new Error(`rsp data error, got empty`);
                            }

                            // for unexpected return format
                            return rspData.match(/\d+\.\d+\.\d+\.\d+/)[0];
                        })
                        .catch(e => console.log("get ip error:", urlIp, e, e.stack))
                    )
                );

                console.log("retIp", retIp);
            } catch (e) {
                console.log(chalk.red(`get public ip error: ${e} ${e.stack}`));
            }
            // console.log(chalk.red(`get public ip error: ${e}`));
        }
        console.log(chalk.green("got public ip"), chalk.blueBright(this.ip_public));

        this.save();
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
        fs.writeFileSync(
            this.runtimeFilePath,
            JSON.stringify(this, null, 2));
        turtleVerbose("RUNTIME SAVED");
    }

    get runtimeFilePath(): string {
        return path.resolve(process.cwd(), `.${turtle.conf.name}-${turtle.conf.id}.turtle`);
    }

    checkProcessAlive(): number | false {
        if (!fs.existsSync(this.runtimeFilePath)) {
            return false;
        }
        const oldRuntime = fs.readJsonSync(this.runtimeFilePath);
        if (!oldRuntime || !oldRuntime.pid) {
            return false;
        }
        try {
            process.kill(oldRuntime.pid, 0);
            return oldRuntime.pid;
        }
        catch (e) {
            return false;
        }
    }
}
