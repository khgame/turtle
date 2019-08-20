import * as fs from "fs";
import {ICmd} from "easy-commander";
import chalk from "chalk";
import {alive, checkTurtlesAlives, printTurtlesList} from "./utils";

export const ls: ICmd = {
    desc: "ls <path>",
    args: {
        info: {
            alias: "i",
            desc: "print runtime info of the turtle process",
            input: false
        },
        process: {
            alias: "p",
            desc: "print if the turtle process are active",
            input: false
        }
    },
    exec: async (path: string, cmd: { info?: boolean, process?: boolean }) => {
        if (!cmd) {
            cmd = path as any;
            path = undefined;
        }
        const paths = fs.readdirSync(path || ".");
        const turtles = paths.filter(p => p.startsWith(".") && p.endsWith(".turtle"))

        printTurtlesList(turtles, cmd);
    }
};

