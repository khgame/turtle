import * as NodeCache from "node-cache";
import {forMs} from "kht/lib";

export interface ICacheOptions extends NodeCache.Options {
    loosingWindowRate: number;
}

export interface IMemCache extends NodeCache {
    lock(key: string, ttl?: number): boolean;

    unlock(key: string): boolean;

    lockMany(keys: string[], ttl: number): boolean; // must ttl
    unlockMany(keys: string[]): boolean;

    getLoosingCache<TVal>(key: string, fnGetVal: (key: string) => Promise<TVal>, ttlS: number): Promise<TVal>;
    expireLoosingCache(key: string): boolean;
    isLoosingCacheExpired(key: string): boolean;
    removeLoosingCache(key: string): boolean;
    rewriteLoosingCache<TVal>(key: string, val: TVal, ttlS: number): boolean;
}

export function genMemCache(options?: ICacheOptions): IMemCache {
    // const cache =

    const ret: any = new NodeCache(options);

    function set(key: string, val: any, ttl: number = 0) {
        return ttl > 0 ? ret.set(key, val, ttl) : ret.set(key, val);
    }

    ret.lock = (key: string, ttl: number = 0) => {
        if (ret.get(key) !== undefined) {
            return false;
        }
        return set(key, "", ttl);
    };

    ret.unlock = (key: string) => {
        return ret.del(key) === 1;
    };

    ret.getLoosingCache = async <TVal>(key: string, fnGetVal: (key: string) => Promise<TVal>, ttlS: number = 0): Promise<TVal> => { // todo: test this
        const enableKey = "__enable__" + key;
        const acquireKey = "__acquire__" + key;
        let value: TVal;
        if (ret.get(enableKey) !== undefined || !ret.lock(acquireKey, 1)) { // 1 query per second
            value = ret.get(key);

            for (let t = 50; value === undefined && t <= 250; t += 50) { // try wait up to 750 ms
                await forMs(t);
                value = ret.get(key);
            }

            if (value !== undefined) { // query directly when it's still failed
                return value;
            }
        }
        // locked by me or cache failed. when it triggered by cache-failed, racing may happen.
        try {
            value = await Promise.resolve(fnGetVal(key));
        } catch (ex) {
            throw new Error(`get loosing cache of key ${key} error: ${ex.message} stack: ${ex.stack}`);
        }

        if (value === undefined) { // todo: some times error - when consul failed ?
            return undefined; // if returns undefined, cache will do nothing, acquire lock will be hold until timeout
        }

        const loosingWindowRate = options ? (options.loosingWindowRate && options.loosingWindowRate > 1 ? options.loosingWindowRate : 2) : 2;
        // update loosing cache

        set(key, value, ttlS * loosingWindowRate);
        ret.lock(enableKey, ttlS);
        ret.unlock(acquireKey);

        return ret.get(key);
    };

    ret.expireLoosingCache = (key: string) => {
        const enableKey = "__enable__" + key;
        return ret.unlock(enableKey);
    };

    ret.removeLoosingCache = (key: string) => {
        ret.expireLoosingCache(key);
        return ret.del(key) === 1;
    };

    ret.isLoosingCacheExpired = (key: string) => {
        const enableKey = "__enable__" + key;
        return (ret as IMemCache).get(enableKey) === undefined;
    };

    ret.rewriteLoosingCache = <TVal>(key: string, value: TVal, ttlS: number = 0) => { // this may be override by other process
        const enableKey = "__enable__" + key;
        const loosingWindowRate = options ? (options.loosingWindowRate && options.loosingWindowRate > 1 ? options.loosingWindowRate : 2) : 2;
        set(key, value, ttlS * loosingWindowRate);
        return set(enableKey, "", ttlS * loosingWindowRate);
    };

    ret.lockMany = (keys: string[], ttl: number) => {
        if (ttl <= 0) {
            throw new Error("ttl must be set when lock many");
        }
        if (Object.keys(ret.mget(keys)).length > 0) {
            return false;
        }
        keys.forEach(key => ret.set(key, "", ttl));
        return true;
    };

    ret.unlockMany = (keys: string[]) => {
        keys.forEach(key => ret.del(key));
        return true;
    };

    return ret as IMemCache;
}

export const memMutex = genMemCache();
