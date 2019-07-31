import * as commander from "commander";

export interface IArg {
    alias?: string;
    desc?: string;
    input?: boolean;
}

export interface ICmd {
    desc: string;
    args: {
        [argName: string]: IArg
    };
    exec: (...args: any[]) => Promise<void>;
}

export function createCommand(blob: { [key: string]: ICmd }) {
    for (let cmdName in blob) {
        const cmd = commander.command(cmdName)
            .description(blob[cmdName].desc)
            .action((...args: string[]) => blob[cmdName].exec(...args));
        for (let argName in blob[cmdName].args) {
            const arg: IArg = blob[cmdName].args[argName];
            cmd.option(`${arg.alias ? "-" + arg.alias + "," : ""} --${argName} ${arg.input ? "<" + argName + ">" : ""}`, arg.desc);
        }
    }
}

export function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        // console.log(pid);
        return true;
    }
    catch (e) {
        // console.log(pid, e.code);
        return false;
    }
}
