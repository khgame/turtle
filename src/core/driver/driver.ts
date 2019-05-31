import {EventEmitter} from "events";
import {importClasses, importFunctions} from "../utils/importClasses";
import {IClass, SingletonFactory} from "../utils/singletonFactory";
import * as Path from "path";
import {IDriverAdaptor} from "./interface";
import {driverMetaMgr, IDriverMetadata} from "./meta";

export const driverFactory = new SingletonFactory();

export async function InitDriversFromConstructors(config: any, constructors: Function[], cb?: (e: EventEmitter) => void) {
    if (!config) {
        throw new Error("turtle: drivers' configs are not exit");
    }

    const ev = new EventEmitter();
    if (cb) {
        cb(ev);
    }

    async function initDriver<TConf, TService>(conf: TConf, driver: IDriverMetadata) {
        const instance = driverFactory.get(driver.target as IClass<IDriverAdaptor<TConf, TService>>);
        return await instance.init(conf);
    }

    const drivers = driverMetaMgr.pickDrivers(constructors);
    let results: { [key: string]: any} = {};
    for (const i in drivers) {
        const driver = drivers[i];
        const key = driver.name;
        if (!config[key]) {
            throw new Error(`config of driver ${key} are not exist`);
        }

        const value = await initDriver(config[key], driver);
        ev.emit(key, value);
        results[key] = value;
    }
    return results;
}

export async function InitDrivers(config: any, classOrDirs: Array<string | Function>, cb?: (e: EventEmitter) => void) {
    const constructors: Function[] = [];
    classOrDirs.forEach(cod => {
        if (typeof cod === "string") {
            if (!Path.isAbsolute(cod)) {
                constructors.push(...importFunctions(Path.resolve(__dirname, "../driver", cod)));
            } else {
                constructors.push(...importClasses([cod]));
            }
        } else {
            constructors.push(cod);
        }
    });
    const results = await InitDriversFromConstructors(config, constructors, cb);
    console.log("drivers loaded", Object.keys(results));
    return results;
}

