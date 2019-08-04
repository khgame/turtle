import {ConsoleHelper} from "kht";

import chalk from "chalk";

const {spawn} = require("child_process");
import * as fs from "fs";
import {alive, ICmd} from "./_base";
import {forCondition, timeoutPromise} from "kht/lib";
import {followFileToStdout} from "./utils";

export const restart: ICmd = {
    desc: "restart <name>",
    args: {
        out: {
            alias: "o",
            desc: "specify the file to receive standard input/output logs.",
            input: true
        },
        timestamp: {
            alias: "t",
            desc: "specify the timestamp format of log file's name. [d/h/m/s]",
            input: true
        },
        follow: {
            alias: "f",
            desc: "the -f option causes logs are printed after restart.",
            input: false
        }
    },
    exec: async (name: string, cmd: { info?: string, out?: string, timestamp?: string, follow?: boolean }) => {
        if (!cmd) {
            console.error(`failed: name of turtle process must be given.`);
            return;
        }
        const paths = fs.readdirSync(".");
        const turtles = paths
            .filter(p => p.startsWith(".") && p.endsWith(".turtle"));

        let path = "";
        if (turtles.indexOf(name) >= 0) {
            path = name;
        }
        if (turtles.indexOf("." + name + ".turtle") >= 0) {
            path = "." + name + ".turtle";
        }

        if (!path) {
            console.error(`failed: cannot find the turtle process ${name} in this folder.`);
            return;
        }

        const runtime = JSON.parse(fs.readFileSync("./" + path, {encoding: "UTF-8"}));
        if (!runtime || !runtime.pid) {
            console.error(`failed: cannot find the turtle process ${path} in this folder.`);
            return;
        }
        console.log(`turtle runtime file of ${chalk.greenBright(path)} are loaded`);

        if (alive(runtime.pid)) {
            console.log(`the turtle process ${name} (pid: ${runtime.pid}) is running, try execute kill ${runtime.pid} -2`);
            process.kill(runtime.pid, 2);
            try {
                await timeoutPromise(60000, forCondition(() => !alive(runtime.pid)));
                console.log(`the turtle process ${name} (pid: ${runtime.pid}) has been killed`);
            } catch (ex) {
                console.error(`try kill the turtle process ${name} failed, process exit.`);
                return;
            }
        }

        if (runtime.turtle_cli_version && runtime.turtle_cli_version < 1) {
            console.error(
                `turtle cli version [${runtime.turtle_cli_version || 0}] is too low, expect >= 1 (leb version >= 0.0.57).
please try \`npm i --save @khgame/turtle\` or \`yarn add @khgame/turtle\` to install.
`);
            return;
        }

        if (!runtime.start_cmd || runtime.start_cmd.length <= 0) {
            console.error(`failed: start_cmd cannot be empty`);
            return;
        }

        const now = new Date();

        let timeLength = 24;
        switch (cmd.timestamp) {
            case "d": timeLength = 10; break;
            case "h": timeLength = 13; break;
            case "m": timeLength = 16; break;
            case "s": timeLength = 19; break;
            default: break;
        }


        const exportPath = cmd.out ||
            "./" + path + "." + (now.toISOString()).substr(0, timeLength)
                .replace(/:/g, "-")
                .replace(/\./g, "_") + ".log";

        const out = fs.openSync(exportPath, "a");
        const err = fs.openSync(exportPath, "a");

        const processName = runtime.start_cmd[0]; // todo: sometimes these will not work
        const args = runtime.start_cmd.slice(1);
        console.log("run:", processName, ...args);
        const child = spawn(processName, args, {
            detached: true,
            stdio: [ "ignore", out, err ]
        });
        child.unref();
        console.log(`redirect stdout/stderr to file ${chalk.blueBright(exportPath)}`);

        if (cmd.follow){
            await followFileToStdout(exportPath);
        }

    }
};
