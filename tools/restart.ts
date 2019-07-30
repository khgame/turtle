import {ConsoleHelper} from "kht";
import * as fs from "fs";
import {ICmd} from "./_base";

export const restart: ICmd = {
    desc: "restart <name>",
    args: {
        watch: {
            alias: "w",
            input: false
        }
    },
    exec: async (name: string, cmd: { info: string }) => {
        if (!cmd) {
            console.error(`name of turtle process must be given`);
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
            console.error(`cannot find the turtle process ${path} in this folder`);
            return;
        }

        const turtle = JSON.parse(fs.readFileSync("./" + path, { encoding: "UTF-8"}));

        console.log("this command are not finished");
        console.log(turtle);



        //     .map(p => p.substr(1, p.length - 8) + (cmd.info ? " " + fs.readFileSync(p, { encoding: "UTF-8"}) : ""));
        //
        // turtles.forEach(t => console.log(t));

        //
        // console.log(process.argv.shift());
        // console.log(process.argv);
    }
};
