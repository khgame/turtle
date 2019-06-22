import {Server} from "http";
import * as socketIo from "socket.io";
import {Logger} from "winston";
import {genLogger} from "../logger";

class UserSession {

    lastHeartBeat: number;

    constructor(
        protected readonly io: socketIo.Server,
        public readonly socketId: string,
        public readonly uid: string,
    ) {
        this.heartBeat();
    }

    public get socket(): socketIo.Socket {
        return this.io.sockets.sockets[this.socketId];
    }

    public get survive(): boolean {
        return this.io.sockets.sockets.hasOwnProperty(this.socketId);
    }

    public emit(event: string | symbol, ...args: any[]): boolean {
        if (!this.survive) {
            throw new Error("cannot emit event to a dead session.");
        }
        return this.socket.emit(event, ...args);
    }

    public heartBeat(): this {
        this.lastHeartBeat = Date.now();
        return this;
    }

}

export class WSServer {

    protected _log: Logger;
    public get log(): Logger {
        return this._log || (this._log = genLogger());
    }

    private allSession: { [uid: string]: UserSession } = {};

    private io: socketIo.Server;

    constructor(public readonly server: Server,
                public readonly validateToken: (token: string) => Promise<string | undefined>,
                public readonly callback: (socket: socketIo.Socket, uid: string, message: string) => void,
                public readonly heartbeatTimeOut: number = 10000,
                public readonly checkStatusInterval = 30000) {
        this.initial();
    }

    protected initial() {
        if (!require) {
            throw new Error("Cannot load WSServer. Try to install all required dependencies: socket.io, socket-controllers");
        }

        try {
            this.io = require("socket.io")(this.server);
        } catch (e) {
            throw new Error("socket.io package was not found installed. Try to install it: npm install socket.io --save");
        }

        this.io.on("connection", async (socket: socketIo.Socket) => {
            this.log.info(`ws connected, socket id : ${socket.id}`);

            const token = socket.handshake.query.token;

            const uid = await this.validateToken(token);

            if (!uid) {
                socket.emit("login", "FAILED");
                setTimeout(() => {
                    socket.disconnect();
                }, 1000);
                return false;
            }

            const session = this.createSession(uid, socket.id);
            socket.emit("login", "SUCCESS");

            socket.on("message", (message: string) => {
                this.callback(socket, uid, message);
            });

            socket.on("disconnect", (message: string) => {
                this.removeSession(uid);
            });

            socket.on("heartbeat", (message: string) => {
                session.heartBeat().emit("heartbeat");
            });

            this.log.info(`ws connected, socket id : ${socket.id}`);
        });

        return this.io;
    }

    public emit(uid: string, message: any): this {
        const session = this.allSession[uid];
        if (!this.allSession[uid]) {
            this.log.error(`try emit message to uid ${uid}, but the session are not found`);
        }
        if (this.allSession[uid].survive) {
            this.log.error(`try emit message to uid ${uid}, but the session are not survive`);
        }
        session.emit("message", message); // todo: ???
        return this;
    }

    public emitToUsers(uids: string[], message: any): this {
        (uids || []).forEach(uid => {
            if (!this.allSession[uid]) {
                this.log.error(`try emit message to uid ${uid}, but the session are not found`);
            }
            if (this.allSession[uid].survive) {
                this.log.error(`try emit message to uid ${uid}, but the session are not survive`);
            }
            this.allSession[uid].emit("message", message);
        });
        return this;
    }

    public emitToAll(message: any): this {
        this.io.emit(message);
        return this;
    }

    private removeSession(uid: string) {
        if (!this.allSession[uid]) {
            return false;
        }
        const session = this.allSession[uid];
        if (session.survive) {
            session.socket.disconnect();
        }
        delete this.allSession[uid];
        return true;
    }

    private createSession(uid: string, socketId: string) {
        this.removeSession(uid); // remove the old session
        return this.allSession[uid] = new UserSession(this.io, socketId, uid);
    }

    private checkStatus() {
        const now = Date.now();
        for (const uid of Object.keys(this.allSession)) {
            const session = this.allSession[uid];
            if (now - session.lastHeartBeat > this.heartbeatTimeOut) {
                this.removeSession(uid);
            }
        }
        setTimeout(() => {
            this.checkStatus();
        }, this.checkStatusInterval);
    }
}
