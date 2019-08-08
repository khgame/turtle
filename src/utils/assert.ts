
import {genLogger} from "./logger";
import {CAssert} from "@khgame/err";

export * from "@khgame/err";

export type Assert = CAssert;
export function genAssert(prefix?: string) {
    return new CAssert({
        fnLog: str => {
            const logger = genLogger(prefix);
            if (logger) {
                logger.warn(str);
            }
        }
    });
}






