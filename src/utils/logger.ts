import * as fs from "fs-extra";
import * as path from "path";
import {createLogger, format, transports} from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";
import {turtle} from "../turtle";

export {Logger} from "winston";

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

function logLevel() : string{
    const inDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
    return inDev ? "debug" : "info";
}

function createFileTransport(label: string, options?: {
    prefix?: string
    zippedArchive?: boolean,
    maxSize?: string,
    maxFiles?: string
}) {
    if (!turtle.conf) {
        console.error(`create transport error, turtle's config haven't been set`);
    }

    let nameSpace = label ? label.split(":")[0] : "";
    nameSpace = nameSpace || "main";
    const fileName = `${nameSpace.replace(/[:,&|]/g, "-")}@%DATE%.log`;
    const logDir = ensureLogDir(
        ((options && options.prefix) ? `[${options.prefix.replace(/[:,&|]/g, "-")}]` : "+") +
        `${turtle.conf.name}#${turtle.conf.id}@${turtle.conf.port}`);
    const transport = new DailyRotateFile({
        level: logLevel(),
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

export const genLogger = (label: string = "") => { // development debug
    if (loggers[label]) {
        return loggers[label];
    }
    const t = [
        new transports.Console({
            level: logLevel(),
            format: format.combine(
                format.colorize(),
                format.printf((info) =>
                    `[${info.timestamp}] [${info.level}] [${info.label || "*"}]: ${info.message}`),
            ),
        }),
        createFileTransport(label)
    ];
    if (label && label !== "main" && !label.startsWith("main:") && !label.startsWith(":")) {
        t.push(createFileTransport("main"));
    }

    loggers[label] = createLogger({
        // change level if in dev environment versus production
        level: logLevel(),
        format: format.combine(
            format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss.SSS",
            }),
            format.label({label})
        ),
        transports: t,
    });
    return loggers[label];
};

export async function exitLog() {
    genLogger().info(`★★ flush and shutdown all file loggers (${fileTransports.length}) ★★`);
    await Promise.all(fileTransports.map(t => new Promise((resolve) => {
        t.close();
        t.on("finish", resolve);
    })));
}
