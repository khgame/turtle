import * as fs from "fs-extra";
import * as path from "path";
import {createLogger, format, transports} from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";
import {turtle} from "../turtle";

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

function createFileTransport(label: string, options?: {
    prefix?: string
    zippedArchive?: boolean,
    maxSize?: string,
    maxFiles?: string
}) {
    const nameSpace = label ? label.split(":")[0] : "";
    const fileName = `${nameSpace.replace(/[:,&|]/g, "-")}@%DATE%.log`;
    const logDir = ensureLogDir(
        ((options && options.prefix) ? `[${options.prefix.replace(/[:,&|]/g, "-")}]` : "+") +
        `${turtle.conf.name}#${turtle.conf.id}@${turtle.conf.port}`);
    return new DailyRotateFile({
        level: "verbose",
        filename: path.resolve(logDir, fileName),
        datePattern: "YYYY-MM-DD",
        zippedArchive: (options && options.zippedArchive) || true,
        maxSize: (options && options.maxSize) || "40m",
        maxFiles: (options && options.maxFiles) || "21d",
        format: format.json(),
    });
}


export const genLogger = (label: string = "") => {
    const inDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
    return createLogger({
        // change level if in dev environment versus production
        level: inDev ? "debug" : "info",
        format: format.combine(
            format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss.SSS",
            }),
            format.label({label})
        ),
        transports: [
            new transports.Console({
                level: inDev ? "verbose" : "info",
                format: format.combine(
                    format.colorize(),
                    format.printf((info) =>
                        `[${info.timestamp}] [${info.level}] [${info.label || "*"}]: ${info.message}`),
                ),
            }),
            createFileTransport(label),
            createFileTransport("main")
        ],
    });
};
