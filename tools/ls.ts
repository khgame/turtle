import {ConsoleHelper} from "kht";
import * as fs from "fs";
import {ICmd} from "./_base";

export const ls : ICmd = {
    desc: "ls <path>",
    args: {
        info: {
            alias: "i",
            input: false
        }
    },
    exec: async (path: string, cmd: { info: string }) => {
        if (!cmd) {
            cmd = path as any;
            path = undefined;
        }
        const paths = fs.readdirSync(path || ".");
        const turtles = paths
            .filter(p => p.startsWith(".") && p.endsWith(".turtle"))
            .map(p => p.substr(1, p.length - 8) + (cmd.info ? " " + fs.readFileSync(p, { encoding: "UTF-8"}) : ""));

        turtles.forEach(t => console.log(t));
    }
};
