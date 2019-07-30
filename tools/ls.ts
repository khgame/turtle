import {ConsoleHelper} from "kht";
import * as fs from "fs";

export const ls = {
    desc: "ls <name>",
    args: {
        repo: {
            alias: "i",
        }
    },
    exec: async (path: string, cmd: { repo: string }) => {
        if (!cmd) {
            cmd = path as any;
            path = undefined;
        }
        const paths = fs.readdirSync(path || ".");
        const turtles = paths
            .filter(p =>  p.startsWith(".") && p.endsWith(".turtle"))
            .map(p => p.substr(1, p.length - 8));

        turtles.forEach(t => console.log(t));
    }
};
