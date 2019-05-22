# Turtle

## usage

### install

```npm i --save @khgame/turtle```
or using yarn
```yarn add @khgame/turtle```

### quick start 

```typescript
import {turtle, ITurtleRedis, RedisDriver} from "@khgame/turtle"

turtle.setConf({
                 "name": "server_name",
                 "id": 0,
                 "port": 11821,
                 "drivers": {
                   "mongo": {
                     "host": "127.0.0.1",
                     "port": 27017,
                     "database": "khgame_nft_svr",
                     "username": "",
                     "password": ""
                   },
                   "redis": {
                     "db": 0,
                     "family": 4,
                     "host": "127.0.0.1",
                     "port": 6379,
                     "keyPrefix": "KH_NFTServ_default_redisKey:",
                     "key_mutex_wait_threshold": 100
                   }
                 },
                 "rules": {}
               });
// console.log(turtle.conf) // by this you can access the config

turtle.initialDrivers([ "redis", "mongo" ]); // using built in drivers
// to using redis driver, redisio should be installed
// to using mongo driver, mongoose should be installed

//... 
await RedisDriver.inst.redis.set("key", "val"); // or you can use turtle.drivers
await turtle.drivers("redis").get("key");
//RedisDriver.inst 
//...

```

### using drivers

### create api

once you implemented an api, you can manage it's lifecycle like this
```js
    /** 1. set config to turtle */
    turtle.setConf(/** ... */, false);
    /** 2. create the api instance (or instances) */
    const api = new ApiClass();
    /** 3. put the api instance to turtle.startAll */
    await turtle.startAll([api]);
```

> [this is an example](https://github.com/khgame/turtle/blob/master/example/api/index.ts)  
> and you can clone the repo, and run `npm run ep:api` to test it by your self

### starting with cli application

you can easily create your turtle cli application with several definitions
```js
// bin/index.ts
const cli = new CommondLineApp("example", "0.0.1", [], [new ApiClass()], {
        "name": "example",
        "id": 0,
        "port": 8080,
        "drivers": {
        },
        "rules": {
        }
    }
);

cli.run();
```

> [this is an example](https://github.com/khgame/turtle/blob/master/example/cli/index.ts)  
> and you can clone the repo, and run `npm run ep:cli` to test it by your self



