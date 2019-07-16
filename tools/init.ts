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
    template: string
) {
    return {
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
            "axios": "^0.18.0",
            "fs-extra": "^7.0.1",
            "get-port": "^5.0.0",
            "ioredis": "^4.9.0",
            "ip": "^1.1.5",
            "kcors": "^2.2.2",
            "kht": "^0.0.9",
            "koa": "^2.7.0",
            "koa-bodyparser": "^4.2.1",
            "koa-logger": "^3.2.0",
            "koa-router": "^7.4.0",
            "mongodb": "^3.2.3",
            "mongoose": "^5.5.0",
            "mongoose-long": "^0.2.1",
            "path": "^0.12.7",
            "routing-controllers": "^0.7.7",
            "typedi": "^0.8.0"
        }
    };
}

function defaultConf(name: string, port: string, drivers: string[]) {
    return {
        name: name, // charge_center_higgs
        id: 0,
        port: parseInt(port),
        setting: {log_prod_console: "info" as "info"},
        drivers: {},
        rules: {}
    };
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
        const srcPath = path.resolve(process.cwd(), `src`);
        const defaultConfPath = path.resolve(srcPath, `defaultConf.ts`);
        const indexPath = path.resolve(srcPath, `index.ts`);
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
        const driversStr: string = await ConsoleHelper.question("drivers: ") as string || "";
        const drivers: string[] = driversStr.split(" ").filter(v => !!v);

        const template: string = await ConsoleHelper.question("template: ") as string || "web-api";
        let port = "";
        if (template.trim() === "web-api") {
            port = await ConsoleHelper.question("port (8001): ") as string || "8001";
        }

        if (!fs.existsSync(pkgPath)) {
            const json = packageJson(name, version, desc, repo, keywordsStr.split(" ").filter(v => !!v), author, license, template);
            fs.writeJSONSync(pkgPath, json, {
                spaces: 2
            });
            fs.ensureDirSync(srcPath);


            fs.writeFileSync(defaultConfPath, `export const defaultConf = ${JSON.stringify(defaultConf(name, port, drivers))}`);
            fs.writeFileSync(indexPath, `
import {defaultConf} from "./defaultConf";
import {CommandLineApp} from "@khgame/turtle/lib";
import {Api} from "./api";

import * as controllers from "./controllers";
import {IHiggsInfo} from "./const/IHiggsInfo";

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
