import * as IORedis from "ioredis";
import {forMs} from "kht";
import {Driver, IDriverAdaptor} from "../core";
import {turtle} from "../turtle";

export interface IRedisConf extends IORedis.RedisOptions {
    key_mutex_wait_threshold?: number;
}

export interface ITurtleRedis extends IORedis.Redis {
    dLock: (key: string, lockerIdentity: string, lockTime?: number, bWaitForLock?: boolean) => Promise<boolean>;
    dUnlock: (key: string, lockerIdentity: string) => Promise<-1 | 0 | 1>;
}

export const getRedisKey =
    (...keys: string[]) =>
        keys.reduce((_, s) => `${_}:${s}`);

let redisLockCountMax = 100;
let redisLockCount: any = {};

async function dLock(key: string,
                            lockerIdentity: string,
                            lockTime: number = 5000,
                            bWaitForLock: boolean = true) {
    if (!key) {
        throw new Error(`redisLock error : lock key cannot be empty`);
    }
    redisLockCount[key] = redisLockCount[key] ? redisLockCount[key] + 1 : 0;
    if (redisLockCount[key] >= 100) {
        throw new Error(`redisLock error : too much(${redisLockCount[key]}) wait for key<${key}>`);
    }
    const redisKey = getRedisKey("mutex", key);
    let ret: any;
    do {
        ret = await Promise.resolve(this.send_command("set", redisKey, lockerIdentity, "PX", lockTime, "NX"));
    } while (ret !== "OK" || !bWaitForLock || (await forMs(5 * redisLockCount[key]) && false));
    redisLockCount[key] -= 1;
    return "OK" === ret;
}

async function dUnlock(key: string, lockerIdentity: string): Promise<-1 | 0 | 1> {
    const redisKey = getRedisKey("mutex", key);
    if (lockerIdentity !== await this.get(redisKey)) {
        return -1;
        // throw new Error("redis unlock error: locker identity are not match");
        // don't interrupt the program
    }
    return await this.pexpire(redisKey, 1);
}

const DRIVER_NAME = "redis";

@Driver(DRIVER_NAME)
export class RedisDriver implements IDriverAdaptor<IRedisConf, ITurtleRedis>{

    public static get inst(): ITurtleRedis{
        return turtle.driver(DRIVER_NAME) as ITurtleRedis;
    }

    protected ioredis: IORedis.Redis;

    protected loadRedis(conf: IRedisConf) {
        if (!require) {
            throw new Error("Cannot load ioredis. Try to install all required dependencies.");
        }
        if (!this.ioredis) {
            try {
                this.ioredis = new (require("ioredis"))(conf);
            } catch (e) {
                throw new Error("ioredis package was not found installed. Try to install it: npm install ioredis --save");
            }
        }
        return this.ioredis;
    }

    public async init(conf: IRedisConf): Promise<ITurtleRedis> {
        redisLockCountMax = conf.key_mutex_wait_threshold || 100;

        const redis: any = this.loadRedis(conf);
        redis.dLock = dLock.bind(redis);
        redis.dUnlock = dUnlock.bind(redis);
        return redis as ITurtleRedis;
    }
}
