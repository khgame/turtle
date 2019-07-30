#!/usr/bin/env node
import * as commander from "commander";
import {init} from "./init";
import {ls} from "./ls";

commander.version(process.version);

commander.command("init")
    .description(init.desc)
    .action((...args: string[]) => (init.exec as any)(...args));

commander.command("ls")
    .description(ls.desc)
    .action((...args: string[]) => { (ls.exec as any)(...args); });

commander.parse(process.argv);
