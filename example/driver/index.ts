import {turtle} from "../../src/";
import * as Path from "path";
import {ITurtleRedis} from "../../src/driver/redis";

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
    await turtle.initialDrivers(["mongo", "redis"]);
    /** 3. using interface-api */
    const redis = turtle.driver<ITurtleRedis>();
    await redis.set("driver_test", 1);
    /** 4. using dynamic-api */
    const result = await turtle.drivers.redis.get("driver_test");
    console.log(result);
    setInterval(() => console.log("update " + Date.now()), 5000);
}

start().then(() => {
    console.log("service started");
});

