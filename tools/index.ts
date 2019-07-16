#!/usr/bin/env node
import * as commander from "commander";
import {init} from "./init";

commander.version(process.version);

commander.command("init")
    .description(init.desc)
    .action((options) => init.exec(options));

commander.parse(process.argv);
