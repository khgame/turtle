import {IClass, SingletonFactory} from "../utils/singletonFactory";
import {IDriverAdaptor} from "./interface";
import {driverMetaMgr, IDriverMetadata} from "./meta";
import * as Path from "path";
import {importClasses, importFunctions} from "../utils/importClasses";
import {EventEmitter} from "events";
import {turtleVerbose} from "../utils/turtleVerbose";

class DriverFactory {

    factory = new SingletonFactory();

    async initDriver<TConf, TService>(conf: TConf, driver: IDriverMetadata) {
        const instance = this.factory.get(driver.target as IClass<IDriverAdaptor<TConf, TService>>);
        return await instance.init(conf);
    }

    async initAll(config: any, classOrDirs: Array<string | Function>, cb?: (e: EventEmitter) => void) {
        /** export event emitter */
        const ev = new EventEmitter();
        if (cb) {
            cb(ev);
        }

        /** convert all to constructors */
        const constructors: Function[] = [];
        classOrDirs.forEach(cod => {
            if (typeof cod === "string") {
                if (!Path.isAbsolute(cod)) {
                    constructors.push(...importFunctions(Path.resolve(__dirname, "../../driver", cod)));
                } else {
                    constructors.push(...importClasses([cod]));
                }
            } else {
                constructors.push(cod);
            }
        });

        /** convert all constructors to driver metas */
        const driverMetas = driverMetaMgr.pickDriverMetas(constructors);

        /** initial all drivers */
        const results: { [key: string]: any } = {};
        for (const i in driverMetas) {
            const driverMeta = driverMetas[i];
            const key = driverMeta.name;
            if (!config[key]) {
                throw new Error(`config of driver ${key} are not exist`);
            }

            const value = await this.initDriver(config[key], driverMeta);
            ev.emit(key, value);
            results[key] = value;
        }

        /** return drivers map */
        turtleVerbose("DRIVERS INITIALED", `drivers:${Object.keys(results).reduce((p, s) => p + " ◆ " + s, "")}`);
        return results;
    }

    async reloadAll(config: any, cb?: (e: EventEmitter) => void) {
        /** export event emitter */
        const ev = new EventEmitter();
        if (cb) {
            cb(ev);
        }

        const results: { [key: string]: any } = {};
        for (const i in this.factory.instances) {
            const d = this.factory.instances[i];
            const driverMeta = driverMetaMgr.pickDriverMeta(d.type);
            const key = driverMeta.name;
            if (!config[key]) {
                throw new Error(`config of driver ${key} are not exist`);
            }
            await d.object.reload(config[key]);
            ev.emit(key, d.object);
            results[key] = d.object;
        }

        /** return drivers map */

        turtleVerbose("DRIVERS RELOADED", ... Object.keys(results));
        return results;
    }

    async triggerApiStart() {
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onApiStart) {
                await driverAdaptor.onApiStart();
            }
        }
    }

    async triggerApiClose() {
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onApiClose) {
                await driverAdaptor.onApiClose();
            }
        }
    }

    async triggerWorkerStart() {
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onWorkerStart) {
                await driverAdaptor.onWorkerStart();
            }
        }
    }

    async triggerWorkerClose() {
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onWorkerClose) {
                await driverAdaptor.onWorkerClose();
            }
        }
    }

}

export const driverFactory = new DriverFactory();
