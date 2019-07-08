import {Logger} from "winston";
import {genLogger} from "./logger";

type StringMethod = () => string;

export class CError extends Error {

    constructor(public readonly code: number | string, msg: string | Error | StringMethod) {
        super(
            (typeof msg === "string")
                ? msg
                : ((msg instanceof Error)
                ? msg.message : msg())
        );
        Object.setPrototypeOf(this, CError.prototype);
        this.name = "CError";
    }
}

export class Assert {

    protected _log: Logger;

    public get log(): Logger {
        return this._log || (this._log = genLogger(this.prefix));
    }

    constructor(public prefix?: string) {
    }

    cok<T>(condition: T, code: number, msg: string | Error | StringMethod) {
        if (condition instanceof Promise) {
            throw new Error("assert condition cannot be a promise");
        }

        if (condition) {
            return;
        }

        let msgStr: string = "";
        let err = msg;
        if (typeof msg === "string") {
            msgStr = msg;
            err = new CError(code, msgStr);
        } else if (msg instanceof Error) {
            err = new CError(code, msg as Error);
            msgStr = code + ": " + err.message + " stack: " + err.stack;
        } else {
            msgStr = (msg as StringMethod)();
            err = new CError(code, msgStr);
        }
        this.log.warn(msgStr);
        throw err;
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
        } else if (msg instanceof CError) {
            const err = (msg as CError);
            msgStr = err.code + ": " + err.message + " stack: " + err.stack;
        } else if (msg instanceof Error) {
            const err = (msg as Error);
            msgStr = err.message + " stack: " + err.stack;
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






