#!/usr/bin/env node
import * as commander from "commander";
import {init} from "./init";
import {ls} from "./ls";
import {restart} from "./restart";
import {createCommand} from "./_base";

commander.version(process.version);

createCommand({init, ls, restart});

commander.parse(process.argv);
