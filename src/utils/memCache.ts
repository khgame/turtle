import * as NodeCache from "node-cache";
import {forMs} from "kht/lib";

export interface IMemCache extends NodeCache {
    lock(key: string, ttl?: number): boolean;

    unlock(key: string): boolean;

    lockMany(keys: string[], ttl: number): boolean; // must ttl
    unlockMany(keys: string[]): boolean;
}

export function genMemCache(options?: NodeCache.Options): IMemCache {
    const cache = new NodeCache(options);

    const ret: any = cache;

    ret.lock = (key: string, ttl: number = 0) => {
        if (cache.get(key) !== undefined) {
            return false;
        }
        return ttl > 0 ? cache.set(key, "", ttl) : cache.set(key, "");
    };

    ret.unlock = (key: string) => {
        return cache.del(key) === 1;
    };

    ret.getLoosingCache = async (key: string, fnGetVal: (key: string) => Promise<any>, ttl: number = 0) => { // todo: test this
        const enableKey = "__enable__" + key;
        const acquireKey = "__acquire__" + key;
        if (cache.get(enableKey) !== undefined || !ret.lock(acquireKey, 1)) { // 1 query per second
            let value = cache.get(key);
            let t = 50;
            while (value === undefined && t <= 250) { // up to 750 ms
                await forMs(t);
                value = cache.get(key);
                t += 50;
            }

            if (value) {
                return value;
            }
        }
        // locked by me or cache failed. when it triggered by cache-failed, racing may happen.
        try {
            // update loosing cache
            let value = await fnGetVal(key);
            ret.lock(enableKey, ttl);
            cache.set(key, value, ttl * 2);
        } catch {
        }
        ret.unlock(acquireKey);
        return;
    };

    ret.lockMany = (keys: string[], ttl: number) => {
        if (ttl <= 0) {
            throw new Error("ttl must be set when lock many");
        }
        if (Object.keys(cache.mget(keys)).length > 0) {
            return false;
        }
        keys.forEach(key => cache.set(key, "", ttl));
        return true;
    };

    ret.unlockMany = (keys: string[]) => {
        keys.forEach(key => cache.del(key));
        return true;
    };

    return ret as IMemCache;
}

export const memMutex = genMemCache();
