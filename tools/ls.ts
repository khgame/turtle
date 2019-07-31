import {ConsoleHelper} from "kht";
import * as fs from "fs";
import {alive, ICmd} from "./_base";

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
    exec: async (path: string, cmd: { info: string, process: string }) => {
        if (!cmd) {
            cmd = path as any;
            path = undefined;
        }
        const paths = fs.readdirSync(path || ".");
        const turtles = paths
            .filter(p => p.startsWith(".") && p.endsWith(".turtle"))
            .map(fName => ({
                name: fName,
                runtime: JSON.parse(fs.readFileSync(fName, {encoding: "UTF-8"}))
            })).map(fstat => ({
                ...fstat,
                active: alive(fstat.runtime.pid)
            }));
        turtles.forEach(t => {
            const {name, runtime, active} = t;
            const print: any[] = [name];
            if (cmd.process) {
                print.push(active ? `◆ON:${runtime.pid}◆` : `◇OFF:${runtime.pid}◇` );
            }
            if (cmd.info) {
                print.push(runtime);
            }

            console.log(...print);
        });
    }
};

