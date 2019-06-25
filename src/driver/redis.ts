import * as IORedis from "ioredis";
import {forMs} from "kht";
import {Driver, IDriverAdaptor} from "../core";
import {turtle} from "../turtle";

export interface IRedisConf extends IORedis.RedisOptions {
    key_mutex_wait_threshold?: number;
}

export interface ITurtleRedis extends IORedis.Redis {
    dLock: (key: string | string [], lockerIdentity: string, lockTimeMS?: number, retry?: number) => Promise<boolean>;
    dUnlock: (key: string | string [], lockerIdentity: string) => Promise<-1 | 0 | 1>;
}

export const getRedisKey =
    (...keys: string[]) =>
        keys.reduce((_, s) => `${_}:${s}`);

let redisLockCountMax = 100;
let redisLockCount: any = {};

async function dLock(key: string | string [],
                     lockerIdentity: string,
                     lockTimeMS: number = 5000,
                     retry: number = -1) {
    // console.log("d-lock start", key);
    if (!key) {
        throw new Error(`redisLock error : lock key cannot be empty`);
    }

    const redis: IORedis.Redis = this;
    if (typeof key === "string") {
        redisLockCount[key] = redisLockCount[key] ? redisLockCount[key] + 1 : 0;
        if (redisLockCount[key] >= 100) {
            throw new Error(`redisLock error : too much(${redisLockCount[key]}) wait for key<${key}>`);
        }
        const redisKey = getRedisKey("mutex", key);
        let ret: any;
        do {
            ret = await Promise.resolve(redis.send_command("set", redisKey, lockerIdentity, "PX", lockTimeMS, "NX"));
            // todo: avoid dead lock
            // console.log("d-lock round", retry, 5 * redisLockCount[key]);
        } while (ret !== "OK" && retry-- !== 0 && (await forMs(5 * redisLockCount[key]) || true));
        redisLockCount[key] -= 1;
        // console.log("d-lock end", ret);
        return "OK" === ret;
    } else {
        let ret: any[][] = [];
        do {
            // console.log("d-lock round " + retry);
            ret = await redis.multi( // multi will not roll back, some key may be locked first
                key.map(k => getRedisKey("mutex", k))
                    .map((k, i) => ["set", k, lockerIdentity, "PX", `${lockTimeMS}`, (ret.length > i && ret[i][1] === "OK") ? "XX" : "NX"])
            ).exec();
            // console.log("d-lock round", retry, ret);
        } while (ret.findIndex(s => s[1] !== "OK") >= 0 && retry-- !== 0 && (await forMs(10) || true));
        // console.log("d-lock end", ret, ret.findIndex(s => s[1] !== "OK"));
        return ret.findIndex(s => s[1] !== "OK") < 0;
    }

}

async function dUnlock(key: string | string[], lockerIdentity: string): Promise<-1 | 0 | 1 | number[]> {
    const redis: IORedis.Redis = this;
    if (typeof key === "string") {
        const redisKey = getRedisKey("mutex", key);
        if (lockerIdentity !== await this.get(redisKey)) {
            return -1;
            // throw new Error("redis unlock error: locker identity are not match");
            // don't interrupt the program
        }
        return await this.pexpire(redisKey, 1);
    }else {
        return await Promise.all(key.map(k => dUnlock.bind(redis)(k, lockerIdentity)));
    }
}

const DRIVER_NAME = "redis";

@Driver(DRIVER_NAME)
export class RedisDriver implements IDriverAdaptor<IRedisConf, ITurtleRedis> {

    public static get inst(): ITurtleRedis {
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
