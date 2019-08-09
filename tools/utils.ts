import {forCondition, forMs} from "kht/lib";
import * as fs from "fs";
import {promisify} from "util";

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
    // const stat = await promisify(fs.stat)(path);

    return fs.readFileSync(path, {encoding: "UTF-8"});

    // const stream = fs.createReadStream(path, {
    //     start: 0,
    //     encoding: "UTF-8"
    // });
    //
    // let end = false;
    // stream.on("data", (data) => {
    //     process.stdout.write(data);
    // });
    //
    // stream.on("end", () => {
    //     end = true;
    // });
    //
    // await forCondition(() => end);
    // await forMs(100);
}


export async function followFileToStdout(path: string) {
    let currentSize = 0;
    while (true) {
        const stat = await promisify(fs.stat)(path);
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
