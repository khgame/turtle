import {forCondition, forMs, Git} from "kht/lib";
import * as fs from "fs-extra";
import {Stats} from "fs-extra";
import * as Path from "path";
import chalk from "chalk";

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


export function getTurtleInfo(name: string): string {
    const paths = fs.readdirSync(".");
    const info: { [key: string]: any } = {};
    const turtles = paths
        .filter(p => p.startsWith(".") && p.endsWith(".turtle"));

    turtles.forEach(fName => {
        info[fName] = JSON.parse(fs.readFileSync(fName, {encoding: "UTF-8"}));
    });

    let path = "";
    if (info[name]) {
        path = name;
    }
    else if (info["." + name + ".turtle"]) {
        path = "." + name + ".turtle";
    }
    else {
        for (const key in info) {
            console.log("info[key].pid", info[key].pid, name);
            if (info[key].pid.toString() !== name) {
                continue;
            }
            path = key;
        }
    }

    return path;
}

export function checkTurtlesAlives(turtlesPathes: string[]) {
    return turtlesPathes.map(fName => ({
        name: fName,
        runtime: JSON.parse(fs.readFileSync(fName, {encoding: "UTF-8"}))
    })).map(fstat => ({
        ...fstat,
        active: alive(fstat.runtime.pid)
    }));
}

export function printTurtlesList(turtlesPathes: string[], option: { process?: boolean, info?: boolean } = {}) {
    return checkTurtlesAlives(turtlesPathes).forEach(t => {
        const {name, runtime, active} = t;
        const print: any[] = [name];
        if (option.process) {
            print.push(active
                ? chalk.greenBright(`◆ON:${runtime.pid}◆`)
                : chalk.redBright(`◇OFF:${runtime.pid}◇`)
            );
        }
        if (option.info) {
            print.push(runtime);
        }
        console.log(...print);
    });
}

export function getTimeString(format: string): string {
    const now = new Date();

    let timeLength = 24;
    switch (format) {
        case "d":
            timeLength = 10;
            break;
        case "h":
            timeLength = 13;
            break;
        case "m":
            timeLength = 16;
            break;
        case "s":
            timeLength = 19;
            break;
        default:
            break;
    }

    return (now.toISOString()).substr(0, timeLength).replace(/:/g, "-").replace(/\./g, "_");
}

export function printFileToStdout(path: string) {
    const log = fs.readFileSync(path, {encoding: "UTF-8"});
    process.stdout.write(log);
    return log;
}


export async function followFileToStdout(path: string) {
    let currentSize = 0;
    while (true) {
        const stat: Stats = await fs.stat(path);
        if (currentSize === 0) {
            currentSize = stat.size;
        }

        const stream = fs.createReadStream(path, {
            start: currentSize,
            encoding: "UTF-8"
        });

        let end = false;
        stream.on("data", (data) => {
            process.stdout.write(data);
        });

        stream.on("end", () => {
            end = true;
        });

        await forCondition(() => end);
        await forMs(100);
        currentSize = stat.size;
    }
}


export async function loadTemplate(url: string) {

    if (!url) {
        return null;
    }

    if (url.indexOf("/") < 0) {
        url = `https://github.com/khgame/tur-${url}.git`;
    }

    const tplDir = Path.resolve(process.cwd(), ".turtle_tpl");

    console.log(`try fetch template from ${url}`);
    await Git.fetchAsFiles(url, tplDir).catch(err => {
        console.log("get tables failed", err);
        fs.removeSync(tplDir);
    });

    return tplDir;
}

export function sizeNumberToHumanReadableString(value: number, padstart: boolean) {
    const trillion = 1000000000000;
    const billion = 1000000000;
    const million = 1000000;
    const thousand = 1000;
    const abs = Math.abs(value || 0);
    let symbol = "b";
    if (abs >= trillion) {
        symbol = "tb";
        value = value / trillion;
    } else if (abs < trillion && abs >= billion) {
        // billion
        symbol = "gb";
        value = value / billion;
    } else if (abs < billion && abs >= million) {
        symbol = "mb";
        value = value / million;
    } else if (abs < million) {
        symbol = "kb";
        value = value / thousand;
    }
    let ret = value.toFixed(2);
    ret = ret.padStart(6, " ");
    return `${ret} ${symbol}`;
}


let _pkgConf: any = {};
try {
    _pkgConf = require("../package.json");
} catch {
}
export const pkgConf = _pkgConf;
