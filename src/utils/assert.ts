import {Logger} from "winston";
import {genLogger} from "./logger";
import {CAssert, CError, StringMethod} from "@khgame/err";

export * from "@khgame/err";

export class Assert extends CAssert {

    protected _log: Logger;

    public get logger(): Logger {
        return this._log || (this._log = genLogger(this.prefix));
    }

    constructor(public prefix?: string) {
        super({
            fnLog: str => {
                if (this.logger) {
                    this.logger.warn(str);
                }
            }
        });
    }

    /**
     * @deprecated
     * @param {T} condition
     * @param {string | Error | StringMethod} msg
     */
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
        this.logger.warn(msgStr);
        throw msg;
    }

    /**
     * @deprecated
     * @param {T} a
     * @param {T} b
     * @param {string | Error | StringMethod} msg
     * @return {undefined}
     */
    sEqual<T>(a: T, b: T, msg: string | Error | StringMethod) {
        return this.ok(a === b, msg);
    }

    /**
     * @deprecated
     * @param {T} a
     * @param {T} b
     * @param {string | Error | StringMethod} msg
     * @return {undefined}
     */
    sNotEqual<T>(a: T, b: T, msg: string | Error | StringMethod) {
        return this.ok(a !== b, msg);
    }
}

export function genAssert(prefix?: string) {
    return new Assert(prefix);
}






