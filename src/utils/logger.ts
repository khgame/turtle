import * as fs from "fs-extra";
import * as path from "path";
import {createLogger, format, Logger, transports} from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";
import {turtle} from "../turtle";

export {Logger} from "winston";

enum NPM_LOGGING_LEVELS {
    error = "error",
    warn = "warn",
    info = "info",
    verbose = "verbose",
    debug = "debug",
    silly = "silly"
}

function ensureLogDir(folder?: string): string {
    let logDir: string = "logs";
    if (folder) {
        logDir = path.resolve(logDir, folder);
    }
    if (!fs.existsSync(logDir)) {
        fs.ensureDirSync(logDir);
    }
    return logDir;
}

const fileTransports: any[] = [];

export interface IFileTransportOption {
    prefix?: string;
    zippedArchive?: boolean;
    maxSize?: string;
    maxFiles?: string;
}

function createFileTransport(label: string, options?: IFileTransportOption) {
    if (!turtle.conf) {
        console.error(`create transport error, turtle's config haven't been set`);
        return;
    }

    let nameSpace = label ? label.split(":")[0] : "";
    nameSpace = nameSpace || "main";
    const fileName = `${nameSpace.replace(/[:,&|]/g, "-")}@%DATE%.log`;

    const logDir = ensureLogDir(
        ((options && options.prefix) ? `[${options.prefix.replace(/[:,&|]/g, "-")}]` : "+") +
        `${turtle.conf.name}#${turtle.conf.id}@${turtle.conf.port}`);
    const inDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";

    const transport = new DailyRotateFile({
        level: inDev ? NPM_LOGGING_LEVELS.debug : (turtle.setting.log_prod_file || NPM_LOGGING_LEVELS.debug),
        filename: path.resolve(logDir, fileName),
        datePattern: "YYYY-MM-DD",
        zippedArchive: (options && options.zippedArchive) || true,
        maxSize: (options && options.maxSize) || "40m",
        maxFiles: (options && options.maxFiles) || "21d",
        format: format.json(),
    });
    fileTransports.push(transport);
    return transport;
}

const loggers: any = {};


/**
 * create logger
 *
 * @desc
 * rules:
 * - env development:
 *  - basic level: silly
 *  - console level: silly
 *  - file level: debug
 * - env production:
 *  - basic level: silly
 *  - console level: turtle.setting.log_prod_console or warn
 *  - file level: info
 * @param {string} label - logging label, format:
 * @param options
 * @return {Logger} = the logger
 */
export function genLogger(label: string = "", options?: IFileTransportOption ): Logger { // development debug
    if (loggers[label]) {
        return loggers[label];
    }
    const inDev = turtle.runtime.in_dev;
    const t = [
        new transports.Console({
            level: inDev ? NPM_LOGGING_LEVELS.silly : (turtle.setting.log_prod_console || NPM_LOGGING_LEVELS.warn),
            format: format.combine(
                format.colorize(),
                format.printf((info) =>
                    `[${info.timestamp}] [${info.level}] [${info.label || "*"}]: ${info.message}`),
            ),
        }),
        createFileTransport(label, options)
    ];
    if (label && label !== "main" && !label.startsWith("main:") && !label.startsWith(":")) {
        t.push(createFileTransport("main"));
    }

    loggers[label] = createLogger({
        // change level if in dev environment versus production
        level: NPM_LOGGING_LEVELS.silly,
        format: format.combine(
            format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss.SSS",
            }),
            format.label({label}),
        ),
        transports: t,
    });
    return loggers[label];
}

export async function exitLog() {
    genLogger().info(`★★ flush and shutdown all file loggers (${fileTransports.length}) ★★`);
    await Promise.all(fileTransports.map(t => new Promise((resolve) => {
        t.close();
        t.on("finish", resolve);
    })));
}
