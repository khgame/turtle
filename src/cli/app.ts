import * as commander from "commander";
import * as Path from "path";
import * as fs from "fs-extra";
import {turtle} from "../turtle";
import {IApi, IWorker} from "../core";
import {IConf} from "../conf/interface";
import {CommandsAPI} from "../turtle/commands";
import {Client} from "@khgame/jsonrpc/lib";
import {Command} from "commander";

export class CommandLineApp {

    constructor(
        public appName: string,
        public version: string,
        protected drivers: Array<string | Function>,
        protected api: () => IApi,
        protected workers: Array<() => IWorker>,
        protected defaultConf: IConf,
        protected cmdControllers?: Array<() => Function>
    ) {

    }

    get defaultConfName() {
        const envStr = process.env.NODE_ENV || "development";
        return `${this.appName}.${envStr}.json`;
    }

    setConfig(path?: string, port?: number) {
        /** set default conf */
        turtle.conf = this.defaultConf;

        /** path */
        do {
            /** 1. has been set */
            if (path) {
                try {
                    turtle.setConf(path, true);
                    break;
                } catch (e) {
                    console.error(`load config from ${path} failed`);
                    break;
                }
            }

            let confPath = Path.resolve(process.cwd(), this.defaultConfName);
            /** 2. try use $pwd/ */
            try {
                turtle.setConf(confPath, true);
                console.error(`load config from ${confPath} success`);
                break;
            } catch (ex) {
                console.error(`load config from ${confPath} failed`);
            }

            confPath = `/etc/turtle.d/${this.defaultConfName}`;
            /** 3. try use /etc/turtle.d/ */
            try {
                turtle.setConf(confPath, true);
                console.error(`load config from ${confPath} success`);
                break;
            } catch (ex) {
                console.error(`load config from ${confPath} failed`);
            }

        } while (false);

        /** port */
        if (port) {
            turtle.conf.port = port;
        }
    }

    async main() {
        const c: Command = commander;

        c.version(this.version)
            .command("start")
            .description(`start running service: ${this.appName}`)
            .option("-d, --development",
                `(default env setting) similar to set NODE_ENV=development, and will read ${this.appName}.development.json at executing position as config by default`,
                () => process.env.NODE_ENV = "development")
            .option("-p, --production",
                `similar to set NODE_ENV=production, and will read ${this.appName}.production.json at executing position as config by default`,
                () => process.env.NODE_ENV = "production")
            .option("-c, --config <path>",
                "set config path, and the specified conf will override the default one set by NODE_ENV",
                path => turtle.setConf(path, true))
            .option("-P, --port <port>",
                `the port to serve api, will override the setting in config file, ${this.defaultConf.port} by default`)
            .action(async (options) => {
                this.setConfig(options && options.path, options && options.port);
                // console.log("config path :", turtle.confPath, this.drivers, this.apis);
                await turtle.initialDrivers(this.drivers);
                await turtle.startAll(
                    this.api(),
                    this.workers ? this.workers.map(f => f()) : undefined,
                    this.cmdControllers
                );
                console.log(`turtle started:
config(${turtle.confPath}) => ${JSON.stringify(turtle.conf)}`);
            });

        c.command("extract")
            .description("extract default config to a file")
            .option("-p, --path <path>", `the export path (default: ./${this.defaultConfName})`)
            .action((options) => {
                let extractPath = (options && options.path) || `./${this.defaultConfName}`;
                extractPath = Path.isAbsolute(extractPath) ? extractPath : Path.resolve(process.cwd(), extractPath);
                fs.writeJSONSync(extractPath, this.defaultConf, {
                    spaces: 4
                });
                process.exit(0);
            });

        c.command("reload")
            .description("reload the service")
            .option("-p, --port <port>", `the port of the process`)
            .action(async (options) => {

                if (!options || !options.port) {
                    console.log("must provide the process port");
                    return;
                }

                const command = new CommandsAPI();
                const result = await Client.singleRPC("turtle", `http://localhost:${options.port}`, () => command.reload());
                console.log("rpc result", result);
                process.exit(0);
            });

        await this.customCommands(c);

        c.parse(process.argv);

        /**
         * todo list
         *
         * - matrix
         * - reload log
         * - signal
         */
    }

    async customCommands(c: Command) {

    }

    run() {
        this.main().then(() => {
            console.info(`running ${this.appName}(@khgame/turtle) succeeded.\n`);
        }).catch((reason => {
            console.error(`running ${this.appName}(@khgame/turtle)failed.\nerr => ${reason}`);
            process.exit(1);
        }));
    }
}



