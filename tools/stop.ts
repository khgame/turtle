import * as fs from "fs";
import {ICmd} from "easy-commander";
import {forCondition, timeoutPromise} from "kht/lib";
import chalk from "chalk";
import {alive, getTurtleInfo} from "./utils";


export const stop: ICmd = {
    desc: "stop <name>",
    args: {},
    exec: async (name: string, cmd: { info: string }) => {
        if (!cmd) {
            console.error(chalk.red(`error: name of turtle process must be given.`));
            return;
        }

        const path = getTurtleInfo(name);

        if (!path) {
            console.error(chalk.yellow(`failed: cannot find the turtle process ${path} in this folder.`));
            return;
        }

        const runtime = JSON.parse(fs.readFileSync("./" + path, {encoding: "UTF-8"}));
        if (!runtime || !runtime.pid) {
            console.error(chalk.yellow(`failed: cannot find the turtle process ${path} in this folder.`));
            return;
        }

        if (!alive(runtime.pid)) {
            console.error(chalk.yellow(`failed: process ${runtime.pid} of ${path} is not running.`));
            return;
        }
        console.log(`the turtle process ${chalk.greenBright(name)} (pid: ${chalk.greenBright(runtime.pid)}) is running, try execute kill ${runtime.pid} -2`);
        process.kill(runtime.pid, 2);
        try {
            await timeoutPromise(60000, forCondition(() => !alive(runtime.pid)));
            console.log(`the turtle process ${chalk.greenBright(name)} (pid: ${chalk.greenBright(runtime.pid)}) has been killed`);
        } catch (ex) {
            console.error(chalk.red(`error: try kill the turtle process ${name} failed, process exit.`));
            return;
        }
    }

};

