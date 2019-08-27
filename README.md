![](https://github.com/khgame/turtle/blob/master/doc/banner.png?raw=true)

# Turtle

## Features

- plugin system
- zero-configuration service discovery / rpc
- distributed lock
- progressive development
- graceful exit
- command line interface

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
                   },
                   "discover/consul": {
                         "health": {
                           "api": "api/health"
                         }
                   },
                   CUSTOM_DRIVER_CLASS
                 },
                 "rules": {}
               });
// console.log(turtle.conf) // by this you can access the config

turtle.initialDrivers([ "redis", "mongo", "discover/consul" ]); // using built in drivers
// to use redis driver, redisio should be installed
// to use mongo driver, mongoose should be installed
// to use discover/consul driver, consul should be installed

//...
await RedisDriver.inst.redis.set("key", "val"); // or you can use turtle.drivers
await turtle.drivers("redis").get("key");
//RedisDriver.inst
//...

```

### using drivers

#### mongo

> to use mongo driver, mongoose should be installed

```js
interface IMongoConf {
    host: string;
    port?: string | number;
    database: string;
    username?: string;
    password?: string;
}
```

#### redis

> to use redis driver, redisio should be installed

```js
interface IRedisConf extends IORedis.RedisOptions {
    key_mutex_wait_threshold?: number;
}
```

#### discover/consul

> to use discover/consul driver, consul should be installed

```js
interface IHealth {
    api?: string;
    script?: string;
    interval?: string;
    ttl?: string;
    notes?: string;
    status?: string;
}

interface IConsulConf {
    optional?: boolean; // default false
    options?: {
        host?: string; // (String, default: 127.0.0.1): agent address
        port?: number; //  (Integer, default: 8500): agent HTTP(S) port
        secure?: boolean; // (Boolean, default: false): enable HTTPS
        ca?: string[];
    };
    health: IHealth | IHealth[];
    dc?: string;
    tags?: string[];
}
```

##### did

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
const cli = new CommandLineApp("example", "0.0.1", [], [() => new ApiClass()], {
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
> and you can clone the repo, and run `npm run ep:cli --help` to test it by your self

## Using Cli

### Install

`npm i -g @khgame/turtle`

### Create new project

`turtle init`

- When command `init` are executed, questions of the initiation of a new project will be asked one by one.
  To create a new turtle project, you just need answer these questions.
  All question are optional, you can just skip all question to create a default project.
  For some questions, you may need some more information to decide the answer of it, such as what drivers should be added, or what templates should be used.
  The related information are provided below.
- drivers: you can select drivers when using init command, both code and config will be generate
- template: you can select official template or custom template here. to using custom template, just input the git address to clone
    - official templates: [web](https://github.com/khgame/tur-web)

### Show all turtle in directory

`turtle ls [dir_name]`

- options:

    |option|alias|need args|desc|
    |---|---|---|---|
    |--info|-i|false|show all runtime info of the turtle|
    |--process|-p|false|show pid and alive-status of the turtle process|

### Restart

`turtle restart <turtle_name|turtle_file_name|pid>`

- if the input are not given, all turtles in current directory and their PIDs will be printed.
- to reset the turtles ENV, you can set environments before the command directly e.p. `NODE_ENV=production turtle restart ...`
- options:

    |option|alias|need args|desc|
    |---|---|---|---|
    |--follow|-f|false|restart process and tail the stdout file|

### Stop

`turtle stop <turtle_name|turtle_file_name|pid>`

- idem

### Log

`turtle log`

- By default, the log command will only show turtles' stdout files in the executing dir
- You can using option `-p` to print a logfile for `-f` to follow a logfile.
  If these options are detected, a question will show up after the logFiles' list.
  Hence you just need to select a log file to print or tail by their `sequence` printed.
- Options:

    |option|alias|need args|desc|
    |---|---|---|---|
    |--print|-p|false|print the stdout file|
    |--follow|-f|false|tail the stdout file|

    > When sequence `-1` are specified will select the latest log file.
    > Therefore, you can using pipe to print contents of the latest log file: `(echo -1) | turtle log -p`.

