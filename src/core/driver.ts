import {EventEmitter} from "events";
import {importClasses} from "./utils/importClasses";
import {IClass, SingletonFactory} from "./singletonFactory";

export interface IDriver<TConf, TService> {
    init(conf: TConf): Promise<TService>;
}

interface IDriverMetadata {
    target: Function;
    name?: string;
}

const driverMetas: IDriverMetadata[] = [];

export function Driver(name?: string): Function {
    return function (target: Function) {
        driverMetas.push({
            target,
            name
        });
    };
}

const driverFactory = new SingletonFactory();

function pickDrivers(constructors: Function[]) : IDriverMetadata[]{
    return driverMetas.filter(dm => constructors.indexOf(dm.target) > -1);
}

async function initDriver<TConf, TService>(conf: TConf, driver: IDriverMetadata) {
    const instance = driverFactory.get(driver.target as IClass<IDriver<TConf, TService>>);
    return await instance.init(conf);
}

export async function InitDrivers(config: any, constructors: Function[], cb?: (e: EventEmitter) => void) {
    const ev = new EventEmitter();
    if (cb) {
        cb(ev);
    }

    const drivers = pickDrivers(constructors);
    let results: any = {};
    for (const i in drivers) {
        const driver = drivers[i];
        const key = driver.name;
        if (!config[key]) {
            console.log(`config of driver ${key} are not exist`);
        }
        const value = await initDriver(config[key], driver);
        ev.emit(key, value);
        results[key] = value;
    }
    console.log("drivers loaded", Object.keys(results));
    // console.log("drivers loaded", results);
    return results;
}

export async function InitDriversFromDirs(config: any, dirs: string[], cb?: (e: EventEmitter) => void) {
    const constructors: Function[] = importClasses(dirs);
    return InitDrivers(config, constructors, cb);
}

