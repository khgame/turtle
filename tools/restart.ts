import chalk from "chalk";
import * as fs from "fs";
import {ICmd} from "easy-commander";
import {forCondition, timeoutPromise} from "kht/lib";
import {alive, followFileToStdout, getTimeString, getTurtleInfo, printTurtlesList} from "./utils";
import {spawn} from "child_process";

export const restart: ICmd = {
    desc: "restart <name>",
    args: {
        out: {
            alias: "o",
            desc: "specify the file to receive standard input/output logs.",
            input: true
        },
        timestamp: {
            alias: "t",
            desc: "specify the timestamp format of log file's name. [d/h/m/s]",
            input: true
        },
        follow: {
            alias: "f",
            desc: "the -f option causes logs are printed after restart.",
            input: false
        }
    },
    exec: async (name: string, cmd: { out?: string, timestamp?: string, follow?: boolean }) => {
        if (!cmd) { // if name are not exist, cmd will be move to the first argument's position
            const paths = fs.readdirSync(".");

            const turtles = paths.filter(p => p.startsWith(".") && p.endsWith(".turtle"));

            console.error(`try to restart turtle process failed: name of turtle process must be given.
These turtle process are detected in this directory:
`);
            printTurtlesList(turtles, {process: true});
            return;
        }


        const path = getTurtleInfo(name);

        if (!path) {
            console.error(chalk.yellow(`failed: cannot find the turtle process ${name} in this folder.`));
            return;
        }

        const runtime = JSON.parse(fs.readFileSync("./" + path, {encoding: "UTF-8"}));
        if (!runtime || !runtime.pid) {
            console.error(chalk.yellow(`failed: cannot find the turtle process ${path} in this folder.`));
            return;
        }
        console.log(`turtle runtime file of ${chalk.greenBright(path)} are loaded`);

        if (alive(runtime.pid)) {
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

        if (runtime.turtle_cli_version && runtime.turtle_cli_version < 1) {
            console.error(chalk.red(
                `turtle cli version [${runtime.turtle_cli_version || 0}] is too low, expect >= 1 (leb version >= 0.0.57).
please try \`npm i --save @khgame/turtle\` or \`yarn add @khgame/turtle\` to install.
`));
            return;
        } else if (runtime.turtle_cli_version < 2) {
            console.log(chalk.grey(
                `turtle cli version [${runtime.turtle_cli_version || 0}] cannot support npm_lifecycle_script. 
expect cli version >= 2 (leb version >= 0.0.66) to support this feature.
please try \`npm i --save @khgame/turtle\` or \`yarn add @khgame/turtle\` to install.
`));
        }

        const exportPath = cmd.out || `./${path}.${getTimeString(cmd.timestamp)}.log`;

        let processName: string = ""; // todo: sometimes these will not work
        let args: string[] = [];
        if (runtime.npm_lifecycle_script) { // todo: lost flags
            console.log(chalk.grey(`using npm_lifecycle_script`));
            const CMDs = (runtime.npm_lifecycle_script as string).split(" ").filter(x => x !== "");
            processName = CMDs[0];
            args = CMDs.slice(1);
        } else if (runtime.start_cmd && runtime.start_cmd.length > 0) {
            console.log(chalk.grey(`using start_cmd`));
            processName = runtime.start_cmd[0];
            args = runtime.start_cmd.slice(1);
        }

        if (runtime.node_env) {
            processName = `NODE_ENV=${runtime.node_env} ${processName}`;
        }

        if (!processName) {
            console.error(chalk.red(
                `failed: cannot extract the start info from the turtle file, please check your npm_lifecycle_script or start_cmd`
            ));
            return;
        }

        const out = fs.openSync(exportPath, "a");
        const err = fs.openSync(exportPath, "a");

        console.log(chalk.grey("run:", processName, "args:", ...args));
        const child = spawn(processName, args, {
            detached: true,
            stdio: ["ignore", out, err]
        });

        if (!child) {
            console.error(chalk.red(`restart process "${processName}" with args ${args} failed.`));
            return;
        }

        child.unref();

        console.log(`-
${chalk.blueBright("PROCESS: " + child.pid)} has been created!
Redirect stdout/stderr to file ${chalk.blueBright(exportPath)}
${chalk.grey("To follow the logfile, you can restart process with -f flag, or using turtle log -f command.")}
        `);

        if (cmd.follow) {
            await followFileToStdout(exportPath);
        }

    }
};
