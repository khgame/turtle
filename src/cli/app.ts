import * as commander from "commander";
import * as Path from "path";
import * as fs from "fs-extra";
import {turtle} from "../turtle";
import {IApi} from "../api";
import {IConf} from "../conf/interfece";

export class CommondLineApp {

    constructor(
        public appName: string,
        public version: string,
        protected drivers: Array<string | Function>,
        protected apis: IApi[],
        protected defaultConf: IConf
    ) {

    }

    get defaultConfName(){
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
                    turtle.setConf(path, false);
                    break;
                } catch (e) {
                }
            }

            /** 2. try use $pwd/ */
            try {
                turtle.setConf(Path.resolve(process.cwd(), this.defaultConfName), false);
                break;
            } catch (ex) {
            }

            /** 3. try use /etc/turtle.d/ */
            try {
                turtle.setConf(`/etc/turtle.d/${this.defaultConfName}`, false);
                break;
            } catch (ex) {
            }

        } while (false);

        /** port */
        if (port) {
            turtle.conf.port = port;
        }
    }

    async main() {
        commander.version(this.version)
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
                console.log("config path :", turtle.confPath);
                await turtle.initialDrivers(this.drivers);
                await turtle.startAll(this.apis);
            });

        commander.command("extract")
            .description("extract default config to a file")
            .option("-p, --path <path>", `the export path (default: ./${this.defaultConfName})`)
            .action((options) => {
                let extractPath = (options && options.path) || `./${this.defaultConfName}`;
                extractPath = Path.isAbsolute(extractPath) ? extractPath : Path.resolve(process.cwd(), extractPath);
                fs.writeJSONSync(extractPath, this.defaultConf);
                process.exit(0);
            });

        commander.parse(process.argv);
    }

    run() {
        this.main().then(() => {
            console.info(`running ${this.appName}(@khgame/turtle) succeeded. \nconfig => ${turtle.conf}\n`);
        }).catch((reason => {
            console.error(`running ${this.appName}(@khgame/turtle)failed.\nerr => ${reason}`);
            process.exit(1);
        }));
    }
}



