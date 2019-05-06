import * as fs from "fs-extra";
import * as Path from "path";
import {InitDrivers} from "../core";
import {IConf} from "../conf/interfeces";
import {EventEmitter} from "events";

export class Turtle<IDrivers> {

    public conf: IConf;
    public confPath: any;

    public get drivers(): IDrivers {
        return this._drivers as IDrivers;
    }
    protected _drivers: any;

    public setConf(path: string, force: boolean) {
        if (!force && this.conf) {
            return;
        }

        path = Path.isAbsolute(path) ? path : Path.resolve(process.cwd(), path);
        if (!fs.existsSync(path)) {
            throw new Error(`conf file at path(${path}) cannot be found`);
        }

        let content = fs.readFileSync(path);
        try {
            this.conf = JSON.parse(content.toString());
        } catch (e) {
            throw new Error(`parse conf file at path(${path}) failed, content: ${content.toString()}`);
        }
        this.confPath = path;
    }

    public async initialDrivers(drivers: Array<string | Function>, cb?: (e: EventEmitter) => void) {
        const results = await InitDrivers(this.conf.drivers, drivers, cb);
        this._drivers = this._drivers ? {...this._drivers, ...results} : results; // override
        console.log("\nDRIVERS INITIALED\n");
    }
}

export const turtle = new Turtle<any>();
