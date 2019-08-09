import {ConsoleHelper} from "kht";
import * as fs from "fs";
import {alive, ICmd} from "./_base";
import chalk from "chalk";
import {followFileToStdout} from "./utils";

export const log: ICmd = {
    desc: "log",
    args: {
        follow: {
            alias: "f",
            desc: "the -f option causes log to not stop when end of file is reached, but rather to wait for additional data to be appended to the input. ",
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

        console.log(
            `turtle log files in current dir ${chalk.greenBright(process.cwd())}`
            + turtleLogs.reduce((p, s, i) => p + `\n[${i}] ` + s, ""));

        let selectedLogName = "";
        if (turtleLogs.length > 1) {
            let index = await ConsoleHelper.question("input your selection: ") as string || "";

            if (index.trim() === "") {
                console.error(chalk.red(`error: log file's index must be given.`));
                return;
            }

            let ind = parseInt(index);
            if (ind < -1 || ind >= turtleLogs.length) {
                console.error(chalk.red(
                    `error: ind should be in [0, ${turtleLogs.length}), or -1 which means the last one, got ${ind}.`
                ));
                return;
            }

            if (ind === -1) {
                ind = turtleLogs.length - 1;
            }

            selectedLogName = turtleLogs[ind];
        } else {
            selectedLogName = turtleLogs[0];
        }

        console.log("log file selected:", chalk.blueBright(selectedLogName));

        if (cmd.follow) {
            console.log("==> START FOLLOW", chalk.blueBright(selectedLogName));
            await followFileToStdout(selectedLogName);
            console.log("==> END FOLLOW", chalk.blueBright(selectedLogName));
        }

    }
};

