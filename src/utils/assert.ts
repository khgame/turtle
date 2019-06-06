import {Logger} from "winston";
import {genLogger} from "./logger";

type StringMethod = () => string;

export class Assert {

    protected _log: Logger;

    public get log(): Logger {
        return this._log || (this._log = genLogger(this.prefix));
    }

    constructor(public prefix?: string) {
    }

    ok<T>(condition: T, msg: string | Error | StringMethod) {
        if (condition instanceof Promise) {
            throw new Error("assert condition cannot be a promise");
        }

        if (condition) {
            return;
        }

        let msgStr: string = "";
        if (typeof msg === "string") {
            msgStr = msg;
            msg = new Error(msgStr);
        } else if (msg instanceof Error) {
            msgStr = (msg as Error).message;
        } else {
            msgStr = (msg as StringMethod)();
            msg = new Error(msgStr);
        }
        this.log.warn(msgStr);
        throw msg;
    }

    sEqual<T>(a: T, b: T, msg: string | Error | StringMethod) {
        return this.ok(a === b, msg);
    }

    sNotEqual<T>(a: T, b: T, msg: string | Error | StringMethod) {
        return this.ok(a !== b, msg);
    }
}

export function genAssert(prefix?: string) {
    return new Assert(prefix);
}






