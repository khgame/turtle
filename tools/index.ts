#!/usr/bin/env node
import * as commander from "commander";
import {init} from "./init";
import {ls} from "./ls";
import {restart} from "./restart";
import {stop} from "./stop";
import {createCommand} from "./_base";

commander.version(process.version);

createCommand({init, ls, restart, stop});

commander.parse(process.argv);
