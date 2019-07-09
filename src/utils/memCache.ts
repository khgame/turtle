import * as NodeCache from "node-cache";
import {forMs} from "kht/lib";

export interface IMemCache extends NodeCache {
    lock(key: string, ttl?: number): boolean;

    unlock(key: string): boolean;

    lockMany(keys: string[], ttl: number): boolean; // must ttl
    unlockMany(keys: string[]): boolean;

    getLoosingCache<TVal>(key: string, fnGetVal: (key: string) => Promise<TVal>, ttl: number): Promise<TVal>;
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

    ret.getLoosingCache = async <TVal>(key: string, fnGetVal: (key: string) => Promise<TVal>, ttl: number = 0): Promise<TVal> => { // todo: test this
        const enableKey = "__enable__" + key;
        const acquireKey = "__acquire__" + key;
        let value: TVal;
        if (cache.get(enableKey) !== undefined || !ret.lock(acquireKey, 1)) { // 1 query per second
            value = cache.get(key);

            for (let t = 50; value === undefined && t <= 250; t += 50) { // try wait up to 750 ms
                await forMs(t);
                value = cache.get(key);
            }

            if (value !== undefined) { // query directly when it's still failed
                return value;
            }
        }
        // locked by me or cache failed. when it triggered by cache-failed, racing may happen.
        try {
            value = await fnGetVal(key);
        } catch (ex) {
            throw new Error(`get loosing cache of key ${key} error: ${ex.message} stack: ${ex.stack}`);
        }

        if (value === undefined) { // todo: some times error - when consul failed ?
            return undefined; // if returns undefined, cache will do nothing, acquire lock will be hold until timeout
        }

        // update loosing cache
        cache.set(key, value, ttl * 2);
        ret.lock(enableKey, ttl);
        ret.unlock(acquireKey);

        return value;
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
