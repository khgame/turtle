import {ConsoleHelper} from "kht";

import * as fs from "fs";
import {alive, ICmd} from "./_base";
import {forCondition, timeoutPromise} from "kht/lib";
import chalk from "chalk";


export const stop: ICmd = {
    desc: "stop <name>",
    args: {},
    exec: async (name: string, cmd: { info: string }) => {
        if (!cmd) {
            console.error(chalk.red(`error: name of turtle process must be given.`));
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

