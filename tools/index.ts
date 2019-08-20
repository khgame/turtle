#!/usr/bin/env node
import {cmdMaker} from "easy-commander";
import {init} from "./init";
import {ls} from "./ls";
import {restart} from "./restart";
import {stop} from "./stop";
import {log} from "./log";
import {pkgConf} from "./utils";

cmdMaker
    .append({
        init, ls, restart, stop, log
    })
    .start(
        {
            version: pkgConf.version || process.env.npm_package_version,
            cbFallback: () => ls.exec(process.cwd(), ),
        });

// commander.version(pkgConf.version || process.env.npm_package_version || "0.0.1");
//
// createCommand({init, ls, restart, stop, log});
//
// commander.parse(process.argv);
