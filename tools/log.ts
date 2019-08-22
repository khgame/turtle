import {ConsoleHelper} from "kht";
import * as fs from "fs-extra";
import {ICmd} from "easy-commander";
import chalk from "chalk";
import {followFileToStdout, printFileToStdout, sizeNumberToHumanReadableString} from "./utils";

export const log: ICmd = {
    desc: "log",
    args: {
        follow: {
            alias: "f",
            desc: "the -f option causes log to not stop when end of file is reached, but rather to wait for additional data to be appended to the input. ",
            input: false
        },
        print: {
            alias: "p",
            desc: "the -p option causes log to be printed. ",
            input: false
        },
    },
    exec: async (path: string, cmd: { follow: string, print: string }) => {
        if (!cmd) {
            cmd = path as any;
            path = undefined;
        }
        const paths = fs.readdirSync(path || ".");
        const turtleLogs = paths.filter(p => /.*.turtle.*.log/.test(p));

        const logStatus = await Promise.all(turtleLogs.map(p => fs.stat(p)));

        if (turtleLogs.length === 0) {
            console.log(chalk.yellow(`no turtle logs are found.`));
        }



        console.log(
            `turtle log files in current dir ${chalk.greenBright(process.cwd())}\n`
            + turtleLogs.reduce((p, s, i) => p + `\n[${
                i.toString().padStart(turtleLogs.length.toString().length, " ")}]\t${
                sizeNumberToHumanReadableString(logStatus[i].size, true)}\t${
                s} `, "")
        );

        if (cmd.print || cmd.follow) {
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

            if (cmd.print) {
                console.log("==> START PRINT", chalk.blueBright(selectedLogName));
                printFileToStdout(selectedLogName);
                console.log("==> END PRINT", chalk.blueBright(selectedLogName));
            }

            if (cmd.follow) {
                console.log("==> START FOLLOW", chalk.blueBright(selectedLogName));
                await followFileToStdout(selectedLogName);
                console.log("==> END FOLLOW", chalk.blueBright(selectedLogName));
            }
        }

    }
};

