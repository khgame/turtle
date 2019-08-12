import {ConsoleHelper} from "kht";
import * as fs from "fs-extra";
import * as path from "path";
import {ICmd} from "./_base";
import {loadTemplate, pkgConf} from "./utils";
import * as Path from "path";
import chalk from "chalk";

async function packageJson(
    name: string,
    version: string,
    desc: string,
    repo: string,
    keywords: string[],
    author: string,
    license: string,
    drivers: string[],
    tmpPath: string
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
            "@khgame/turtle": `^${pkgConf.version || "0.0.76"}`,
        },
        devDependencies: {
            "chai": "^4.2.0",
            "cross-env": "^5.2.0",
            "mocha": "^6.1.4",
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
        conf.devDependencies["@types/mongoose"] = "^5.3.17";
    }

    if (drivers.indexOf("redis") >= 0) {
        conf.dependencies["ioredis"] = "^4.9.0";
        conf.devDependencies["@types/ioredis"] = "^4.0.10";
    }

    if (drivers.indexOf("discover/consul") >= 0) {
        conf.dependencies["consul"] = "^4.9.0";
    }


    if (tmpPath) {
        console.log(`create package from ${tmpPath}`);
        try {
            const tplPackage = require(Path.resolve(tmpPath, "package.json"));
            for (const key in tplPackage) {
                for (const entryKey in tplPackage[key]) {
                    conf[key][entryKey] = tplPackage[key][entryKey];
                }
            }

        } catch (ex) {
            console.log(`load template ${tmpPath} error: ${ex} ${ex.stack}`);
            throw ex;
        }
    }

    return conf;
}

function getDefaultConf(name: string, port: string, drivers: string[]) {
    const conf: any = {
        name: name, // charge_center_higgs
        id: 0,
        port: parseInt(port),
        setting: {log_prod_console: "info" as "info"},
        drivers: {},
        rules: {}
    };

    if (drivers.indexOf("mysql") >= 0) {
        conf.drivers["mysql"] = {
            type: "mysql",
            host: "127.0.0.1",
            port: 3306,
            username: "root",
            password: "",
            database: name,
            entities: [
                "src/entity/*"
            ],
            synchronize: true,
            logging: false
        };
    }

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

export const init: ICmd = {
    desc: "init a turtle project",
    args: {
        name: {
            alias: "n",
            input: true
        },
        version: {
            alias: "v",
            input: true
        },
        desc: {
            alias: "d",
            input: true
        },
        repo: {
            alias: "r",
            input: true
        }
    },
    exec: async (cmd: { name: string, version: string, desc: string, repo: string }) => {
        // console.log(process);
        const pkgPath = path.resolve(process.cwd(), `package.json`);
        if (fs.existsSync(pkgPath)) {
            console.log(`[ERROR] package file ${pkgPath} is already exist.`);
            return;
        }

        console.log(`
    ██████  ██  ██  ██████  ██████  ██      ██████
      ██    ██  ██  ██  ██    ██    ██      ██    
      ██    ██  ██  ████      ██    ██      ██████
      ██    ██  ██  ██  ██    ██    ██      ██
      ██    ██████  ██  ██    ██    ██████  ██████ ` + chalk.grey(`@khgame
      
   ┌──────────────────────────────────────────────────────┐
   │ - github - https://github.com/khgame/turtle          │ 
   │ - npm - https://www.npmjs.com/package/@khgame/turtle │ 
   └──────────────────────────────────────────────────────┘
`));
        // console.log(cmd);

        const nameParam = typeof cmd.name === "string" ? cmd.name : null;
        const versionParam = typeof cmd.version === "string" ? cmd.version : null;

        const name: string = nameParam || await ConsoleHelper.question("name (default: turtle-project): ") as string || "turtle-project";
        const version: string = versionParam || await ConsoleHelper.question("version (default: 0.0.1): ") as string || "0.0.1";
        const desc: string = cmd.desc || await ConsoleHelper.question("description: ") as string;
        const repo: string = cmd.repo || await ConsoleHelper.question("repository: ") as string;
        const keywordsStr: string = await ConsoleHelper.question("keywords: ") as string;
        const author: string = await ConsoleHelper.question("author: ") as string;
        const license: string = await ConsoleHelper.question("license (default: MIT): ") as string || "MIT";
        const port = await ConsoleHelper.question("port (default: 8001): ") as string || "8001";
        const driversStr: string = await ConsoleHelper.question("drivers (mongo redis discover/consul): ") as string || "";
        const drivers: string[] = driversStr.split(" ").filter(v => !!v);

        const template: string = await ConsoleHelper.question("template (default: ''): ") as string || "";

        const tplPath = await loadTemplate(template);


        if (!fs.existsSync(pkgPath)) {
            const json = await packageJson(
                name,
                version,
                desc,
                repo,
                keywordsStr.split(" ").filter(v => !!v),
                author,
                license,
                drivers,
                tplPath
            );
            fs.writeJSONSync(pkgPath, json, {
                spaces: 2
            });
            const srcPath = path.resolve(process.cwd(), `src`);
            const lintPath = path.resolve(process.cwd(), `tslint.json`);
            const tsconfigPath = path.resolve(process.cwd(), `tsconfig.json`);
            const defaultConfPath = path.resolve(srcPath, `defaultConf.ts`);
            const indexPath = path.resolve(srcPath, `index.ts`);
            const apiPath = path.resolve(srcPath, `api`);
            const workersPath = path.resolve(srcPath, `workers`);
            const apiIndexPath = path.resolve(apiPath, `index.ts`);
            fs.ensureDirSync(srcPath);
            fs.ensureDirSync(workersPath);
            fs.writeFileSync(defaultConfPath, `
export const defaultConf = ${JSON.stringify(getDefaultConf(name, port, drivers), null, 4)}`);
            fs.ensureDirSync(apiPath);
            fs.writeFileSync(apiIndexPath, `
import {genLogger, IApi, APIRunningState, CError} from "@khgame/turtle/lib";

export class Api implements IApi {

    log = genLogger("api");
    
    
    runningState: APIRunningState = APIRunningState.NONE;
    
    constructor() {
        this.initial();
    }

    async initial() {
        /** do initial procedure here */
        this.runningState = APIRunningState.PREPARED;
    }

    async start(port: number) {
        this.runningState = APIRunningState.STARTING;
        this.log.info('api started');
        this.runningState = APIRunningState.RUNNING;
        this.log.info('★★★ HELLO WORLD ★★★');
        return true;
    };
    
    async close() {
        this.runningState = APIRunningState.CLOSING;
        this.log.info('api closed');
        this.runningState = APIRunningState.CLOSED;
        return true;
    };
            
}
`);
            fs.writeFileSync(indexPath, `
import {defaultConf} from "./defaultConf";
import {CommandLineApp, IConf} from "@khgame/turtle/lib";

/** you should implement this (or using template) */
import {Api} from "./api";

const cli = new CommandLineApp(
    "${name}",
    "${version}",
    ${JSON.stringify(drivers)},
    () => new Api(),
    [], defaultConf as IConf);
cli.run();`);

            fs.writeFileSync(lintPath, `
{
  "linterOptions": {
    "autoFixOnSave": true,
    "exclude": [
      "node_modules/**/*.ts"
    ]
  },
  "rules": {
    "array-type": [true, "array-simple"],
    "arrow-return-shorthand": true,
    "curly": true,
    "comment-format": [
      true,
      "check-space"
    ],
    "quotemark": true,
    "forin": false,
    "indent": [true, "spaces", 4],
    "interface-name": true,
    "jsdoc-format": true,
    "new-parens": true,
    "no-angle-bracket-type-assertion": true,
    "no-construct": true,
    "no-console": false,
    "no-empty": false,
    "no-empty-interface": false,
    "no-var-keyword": true,
    "no-shadowed-variable": true,
    "label-position": true,
    "max-line-length": [
      true,
      180
    ],
    "object-literal-sort-keys": false,
    "prefer-for-of": false,
    "semicolon": [true, "always", "ignore-bound-class-methods"],
    "switch-default": true,
    "triple-equals": [
      true,
      "allow-null-check"
    ],
    "use-isnan": true,
    "variable-name": {
      "options": [
        "ban-keywords",
        "check-format",
        "allow-pascal-case",
        "allow-leading-underscore",
        "allow-trailing-underscore",
        "allow-snake-case"
      ]
    },
    "whitespace": [
      true,
      "check-branch",
      "check-decl",
      "check-operator",
      "check-separator",
      "check-type"
    ]
  }
}
`);

            fs.writeFileSync(tsconfigPath, `
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "*": [
        "types/*"
      ]
    },
    "module": "commonjs",
    "target": "es2015",
    "noImplicitAny": true,
    "skipLibCheck": true,
    "removeComments": true,
    "preserveConstEnums": true,
    "outDir": "bin",
    "sourceMap": true,
    "strict": true,
    "declaration": true,
    "strictPropertyInitialization": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules"
  ]
}
`);
            if (tplPath) {
                console.log(chalk.grey(`copy files from ${tplPath}`));
                fs.copySync(Path.resolve(tplPath, "src"), srcPath);
                fs.removeSync(tplPath);
            }


            console.log(`
==========================================================================================
    
project ${name} created (${template || "no-template"}), some useful commands listed below:

    1. to initial your project, run 'npm install' or 'yarn install'
    2. to build your project, run 'npm run build' or 'yarn build'
    3. to start your project, run 'npm run start' or 'yarn start'
    
==========================================================================================
            `);


        }

    }
};
