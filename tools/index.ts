#!/usr/bin/env node
import * as commander from "commander";
import {init} from "./init";
import {ls} from "./ls";
import {createCommand} from "./_base";

commander.version(process.version);

createCommand({init, ls});

commander.parse(process.argv);
