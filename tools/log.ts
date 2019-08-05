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

        let selectedLogName = "";
        if (turtleLogs.length > 1) {
            const index = await ConsoleHelper.question(
                `turtle log files in current dir ${chalk.greenBright(process.cwd())}`
                + turtleLogs.reduce((p, s, i) => p + `\n[${i}] ` + s, "") + "\ninput your selection: ") as string || "turtle-project";
            if (index.trim() === "") {
                console.error(chalk.red(`error: log file's index must be given.`));
                return;
            }
            const ind = parseInt(index);
            if (ind < 0 || ind >= turtleLogs.length) {
                console.error(chalk.red(`error: ind should be in [0, ${turtleLogs.length}), got ${ind}.`));
                return;
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

