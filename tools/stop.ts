import {ConsoleHelper} from "kht";

import * as fs from "fs";
import {alive, ICmd} from "./_base";
import {forCondition, timeoutPromise} from "kht/lib";


export const stop: ICmd = {
    desc: "stop <name>",
    args: {},
    exec: async (name: string, cmd: { info: string }) => {
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
            console.error(`failed: cannot find the turtle process ${path} in this folder.`);
            return;
        }

        const runtime = JSON.parse(fs.readFileSync("./" + path, {encoding: "UTF-8"}));
        if (!runtime || !runtime.pid) {
            console.error(`failed: cannot find the turtle process ${path} in this folder.`);
            return;
        }

        if (!alive(runtime.pid)) {
            console.error(`failed: process ${runtime.pid} of ${path} in not running.`);
            return;
        }
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

};

