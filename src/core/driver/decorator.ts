import {driverMetaMgr} from "./meta";

export function Driver(name?: string): Function {
    return function (target: Function) {
        driverMetaMgr.register(target, name);
    };
}
