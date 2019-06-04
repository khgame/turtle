import * as NodeCache from "node-cache";

export interface IMemCache extends NodeCache {
    lock(key: string, ttl: number): boolean;
    unlock(key: string): boolean;
}

export function genMemCache(options?: NodeCache.Options): IMemCache {
    const cache = new NodeCache(options);
    const ret: any = cache;

    ret.lock = (key: string, ttl: number = 0) => {
        if (cache.get(key) !== undefined) {
            return false;
        }
        return ttl ? cache.set(key, "", ttl) : cache.set(key, "");
    };

    ret.unlock = (key: string) => {
        return cache.del(key) === 1;
    };

    return ret as IMemCache;
}
