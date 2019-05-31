import {turtle, ITurtleRedis, RedisDriver} from "../../src/";
import * as Path from "path";
// import {Redis} from "ioredis";

async function start() {
    /** 0. environment
     *
     * to using mongo driver, the lib 'mongoose' should be installed
     * to using redis driver, the lib 'ioredis' should be installed
     *
     */
    /** 1. set config to turtle */
    turtle.setConf(Path.resolve(__dirname, `./config.${process.env.NODE_ENV || "development"}.json`), false);
    /** 2. using default redis driver */
    await turtle.initialDrivers(["mongo", "redis", "discover/consul"]);
    /** 3. using interface-api */
    const random = Math.random();
    const redis = await turtle.driver("redis") as ITurtleRedis;
    // or redis RedisDriver.inst;
    console.log(redis === RedisDriver.inst);

    await redis.set("driver_test", random);
    /** 4. using dynamic-api */
    const result = await turtle.drivers.redis.get("driver_test");
    console.log("result", random, result);
    setInterval(() => console.log("update " + Date.now()), 5000);
}

start().then(() => {
    console.log("service started");
});

