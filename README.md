# Turtle

## usage

### install

```npm i --save @khgame/turtle```
or using yarn
```yarn add @khgame/turtle```

### quick start 

```typescript
import {turtle} from "@khgame/turtle"

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

turtle.drivers.redis.set("key", "val")
```

### drivers




