import * as NodeCache from "node-cache";

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

    ret.lockMany = (keys: string[], ttl: number) => {
        if (ttl <= 0){
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
