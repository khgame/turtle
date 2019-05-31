import {IClass, SingletonFactory} from "../utils/singletonFactory";
import {IDriverAdaptor} from "./interface";
import {driverMetaMgr, IDriverMetadata} from "./meta";
import * as Path from "path";
import {importClasses, importFunctions} from "../utils/importClasses";
import {EventEmitter} from "events";

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
        const driverMetas = driverMetaMgr.pickDrivers(constructors);

        /** initial all drivers */
        const results: { [key: string]: any} = {};
        for (const i in driverMetas) {
            const driver = driverMetas[i];
            const key = driver.name;
            if (!config[key]) {
                throw new Error(`config of driver ${key} are not exist`);
            }

            const value = await this.initDriver(config[key], driver);
            ev.emit(key, value);
            results[key] = value;
        }

        /** return drivers map */
        console.log("drivers loaded", Object.keys(results));
        return results;
    }

    async triggerApiStart(){
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onApiStart) {
                await driverAdaptor.onApiStart();
            }
        }
    }

    async triggerApiClose(){
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onApiClose) {
                await driverAdaptor.onApiClose();
            }
        }
    }

    async triggerWorkerStart(){
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onWorkerStart) {
                await driverAdaptor.onWorkerStart();
            }
        }
    }

    async triggerWorkerClose(){
        for (let i in this.factory.instances) {
            const driverAdaptor = this.factory.instances[i].object;
            if (driverAdaptor.onWorkerClose) {
                await driverAdaptor.onWorkerClose();
            }
        }
    }
}

export const driverFactory = new DriverFactory();
