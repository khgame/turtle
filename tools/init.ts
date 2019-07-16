import {ConsoleHelper} from "kht";
import * as fs from "fs-extra";
import * as path from "path";

function packageJson(
    name: string,
    version: string,
    desc: string,
    repo: string,
    keywords: string[],
    author: string,
    license: string,
    drivers: string[],
    template: string
) {
    const conf: any = {
        name: name,
        version: version,
        description: desc,
        main: `bin/index.js`,
        publishConfig: {
            access: "public"
        },
        repository: {
            type: "git",
            url: repo
        },
        keywords: keywords,
        author: author,
        license: license,
        scripts: {
            "test": "mocha -r ts-node/register test/**/*.test.ts --exit",
            "build": "rimraf ./bin && npx tsc",
            "lint": "npx tslint --fix --project .",
            "app": "npx ts-node ./src",
            "watch": "cross-env nodemon --inspect --watch 'src/**/*' -e ts,tsx --exec 'node -r ts-node/register' ./src/index.ts start",
            "start": "npm run build && node ./bin start",
            "prepublishOnly": "npm run build"
        },
        dependencies: {
            "@khgame/turtle": "^0.0.50",
        },
        devDependencies: {
            "chai": "^4.2.0",
            "cross-env": "^5.2.0",
            "nodemon": "^1.18.10",
            "rimraf": "^2.6.3",
            "ts-node": "^8.0.3",
            "tslint": "^5.15.0",
            "typescript": "^3.4.2"
        }
    };

    if (drivers.indexOf("mongo") >= 0) {
        conf.dependencies["mongodb"] = "^3.2.3";
        conf.dependencies["mongoose"] = "^5.5.0";
        conf.dependencies["mongoose-long"] = "^0.2.1";
        conf.dependencies["@types/mongoose"] = "^5.3.17";
    }

    if (drivers.indexOf("redis") >= 0) {
        conf.dependencies["ioredis"] = "^4.9.0";
        conf.dependencies["@types/ioredis"] = "^4.0.10";
    }

    if (drivers.indexOf("discover/consul") >= 0) {
        conf.dependencies["consul"] = "^4.9.0";
    }


    return conf;
}

function defaultConf(name: string, port: string, drivers: string[]) {
    const conf: any = {
        name: name, // charge_center_higgs
        id: 0,
        port: parseInt(port),
        setting: {log_prod_console: "info" as "info"},
        drivers: {},
        rules: {}
    };

    if (drivers.indexOf("mongo") >= 0) {
        conf.drivers["mongo"] = {
            host: "127.0.0.1",
            port: 27017,
            database: name,
            username: "",
            password: ""
        };
    }

    if (drivers.indexOf("redis") >= 0) {
        conf.drivers["redis"] = {
            db: 0,
            family: 4,
            host: "127.0.0.1",
            port: 6379,
            keyPrefix: `turtle:${name}:`,
            key_mutex_wait_threshold: 100
        };
    }

    if (drivers.indexOf("discover/consul") >= 0) {
        conf.drivers["discover/consul"] = {
            optional: false,
            health: {
                api: "api/v1/core/health"
            },
            did: {
                "head_refresh": "process"
            }
        };
    }

    return conf;
}

export const init = {
    desc: "init a turtle project",
    args: {
        repo: {
            alias: "r",
        }
    },
    exec: async (data: { repo: string }) => {
        const pkgPath = path.resolve(process.cwd(), `package.json`);
        if (fs.existsSync(pkgPath)) {
            console.log(`[ERROR] package file ${pkgPath} is already exist.`);
            return;
        }

        const name: string = await ConsoleHelper.question("name (turtle-project): ") as string || "turtle-project";
        const version: string = await ConsoleHelper.question("version (0.0.1): ") as string || "0.0.1";
        const desc: string = await ConsoleHelper.question("description: ") as string;
        const repo: string = await ConsoleHelper.question("repository: ") as string;
        const keywordsStr: string = await ConsoleHelper.question("keywords: ") as string;
        const author: string = await ConsoleHelper.question("author: ") as string;
        const license: string = await ConsoleHelper.question("license (MIT): ") as string || "MIT";
        const driversStr: string = await ConsoleHelper.question("drivers (mongo redis discover/consul): ") as string || "";
        const drivers: string[] = driversStr.split(" ").filter(v => !!v);

        const template: string = await ConsoleHelper.question("template: ") as string || "web-api";
        let port = "";
        if (template.trim() === "web-api") {
            port = await ConsoleHelper.question("port (8001): ") as string || "8001";
        }

        if (!fs.existsSync(pkgPath)) {
            const json = packageJson(name, version, desc, repo, keywordsStr.split(" ").filter(v => !!v), author, license, drivers, template);
            fs.writeJSONSync(pkgPath, json, {
                spaces: 2
            });
            const srcPath = path.resolve(process.cwd(), `src`);
            const defaultConfPath = path.resolve(srcPath, `defaultConf.ts`);
            const indexPath = path.resolve(srcPath, `index.ts`);
            const apiPath = path.resolve(srcPath, `api`);
            const apiIndexPath = path.resolve(apiPath, `index.ts`);
            fs.ensureDirSync(srcPath);
            fs.writeFileSync(defaultConfPath, `
export const defaultConf = ${JSON.stringify(defaultConf(name, port, drivers), null, 4)}`);
            fs.ensureDirSync(apiPath);
            fs.writeFileSync(apiIndexPath, `
import {genLogger, IApi, APIRunningState, CError} from "@khgame/turtle/lib";

export class API implements IApi {

    log = genLogger("api");
    
    runningState: APIRunningState;
    
    async start(port: number) {
        this.log.info('api started');
        return true;
    };
    
    async close() {
        this.log.info('api closed');
        return false;
    };
            
}
`);
            fs.writeFileSync(indexPath, `
import {defaultConf} from "./defaultConf";
import {CommandLineApp} from "@khgame/turtle/lib";

/** you should implement this (or using template) 
import {Api} from "./api";
*/

const cli = new CommandLineApp(
    "${name}",
    "${version}",
    ${JSON.stringify(drivers)},
    () => new Api(),
    [], defaultConf);
cli.run();`);
        }

    }
};
