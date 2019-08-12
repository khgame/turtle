#!/usr/bin/env node
import * as commander from "commander";
import {init} from "./init";
import {ls} from "./ls";
import {restart} from "./restart";
import {stop} from "./stop";
import {log} from "./log";
import {createCommand} from "./_base";
import {pkgConf} from "./utils";




commander.version(pkgConf.version ||  process.version);

createCommand({init, ls, restart, stop, log});

commander.parse(process.argv);
