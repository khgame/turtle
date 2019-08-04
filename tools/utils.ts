import {forCondition, forMs} from "kht/lib";
import * as fs from "fs";
import {promisify} from "util";


export async function followFileToStdout(path: string){
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
