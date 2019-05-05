import {EventEmitter} from "events";
import {importClasses} from "./utils/importClasses";
import {IClass, SingletonFactory} from "./singletonFactory";

export interface IDriver<TConf, TService> {
    init(conf: TConf): Promise<TService>;
}

interface IDriverMetadata {
    type: "default";
    target: object;
    name?: string;
}

const drivers: IDriverMetadata[] = [];

export function Driver(name?: string): Function {
    return function (object: Function) {
        drivers.push({
            type: "default",
            target: object,
            name
        });
    };
}

const driverFactory = new SingletonFactory();

async function initDriver<TConf, TService>(conf: TConf, driver: IDriverMetadata) {
    const instance = driverFactory.get(driver.target as IClass<IDriver<TConf, TService>>);
    return await instance.init(conf);
}

export async function InitDrivers(config: any, classes: Function[] | string[], cb?: (e: EventEmitter) => void) {
    const ev = new EventEmitter();
    if (cb) {
        cb(ev);
    }
    let driverClasses: Function[];
    if (classes && classes.length) {
        driverClasses = (classes as any[]).filter(controller => controller instanceof Function);
        const controllerDirs = (classes as any[]).filter(controller => typeof controller === "string");
        driverClasses.push(...importClasses(controllerDirs));
    }

    let results: any = {};

    for (const i in driverClasses) {
        const driver = drivers.find(d => d.target === driverClasses[i]);
        if (!driver) {
            continue;
        }
        const key = driver.name;
        const value = await initDriver(config[key], driver);
        ev.emit(key, value);
        results[key] = value;
    }
    console.log("drivers loaded", Object.keys(results));

    return results;
}

