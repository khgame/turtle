import {ConsoleHelper} from "kht";
import * as fs from "fs";
import {alive, ICmd} from "./_base";
import chalk from "chalk";
import {promisify} from "util";
import {forCondition} from "kht/lib";

export const log: ICmd = {
    desc: "log <name>",
    args: {
        follow: {
            alias: "f",
            desc: "the -l option causes log to not stop when end of file is reached, but rather to wait for additional data to be appended to the input. ",
            input: false
        }
    },
    exec: async (path: string, cmd: { follow: string, process: string }) => {
        if (!cmd) {
            cmd = path as any;
            path = undefined;
        }
        const paths = fs.readdirSync(path || ".");
        const turtleLogs = paths.filter(p => /.*.turtle.*.log/.test(p));

        if (turtleLogs.length === 0) {
            console.log(chalk.yellow(`no turtle logs are found.`));
        }

        let selectedLogName = "";
        if (turtleLogs.length > 1) {
            const index = await ConsoleHelper.question(
                `turtle log files in current dir ${chalk.greenBright(process.cwd())}`
                + turtleLogs.reduce((p, s, i) => p + `\n[${i}] ` + s, "") + "\ninput your selection: ") as string || "turtle-project";
            selectedLogName = turtleLogs[parseInt(index)];
        } else {
            selectedLogName = turtleLogs[0];
        }

        console.log("selected log file:", chalk.blueBright(selectedLogName));

        let currentSize = 0;
        while (cmd.follow) {
            const stat = await promisify(fs.stat)(selectedLogName);
            if (currentSize === 0) {
                currentSize = stat.size;
            }

            const stream = fs.createReadStream(selectedLogName, {
                start: currentSize,
                encoding: "UTF-8"
            });

            let end = false;

            stream.on("data", (data) => {
                console.log(data);
            });

            stream.on("end", () => {
                end = true;
            });

            await forCondition(() => end);
            currentSize = stat.size;
        }

    }
};

