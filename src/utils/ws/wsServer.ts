import {Server} from "http";
import * as socketIo from "socket.io";
import {Logger} from "winston";
import {genLogger} from "../logger";

class UserSessionFactory {

    protected sessionMap: { [uid: string]: UserSession } = {};

    constructor(
        protected readonly io: socketIo.Server,
        public readonly heartbeatTimeOut: number = 10000,
        public readonly checkStatusInterval = 30000) {
    }

    has(uid: string) {
        return this.sessionMap.hasOwnProperty(uid);
    }

    get(uid: string): UserSession {
        return this.sessionMap[uid];
    }

    create(socketId: string, uid: string) {
        if (this.has(uid)) { // remove the old session
            this.remove(uid);
        }
        return this.sessionMap[uid] = new UserSession(this.io, socketId, uid);
    }

    public remove(uid: string): boolean {
        const session = this.get(uid);
        if (!session) {
            return false;
        }
        if (session.survive) {
            session.socket.disconnect();
        }
        delete this.sessionMap[uid];
        return true;
    }

    public heartBeat(uid: string) {

        const session = this.get(uid);
        if (!session) {
            return false;
        }
        session.heartBeat();
        return true;
    }

    public evictInactive() {
        const now = Date.now();
        for (const uid of Object.keys(this.sessionMap)) {
            const session = this.sessionMap[uid];
            if (now - session.lastHeartBeat > this.heartbeatTimeOut) {
                this.remove(uid);
            }
        }
        setTimeout(() => {
            this.evictInactive();
        }, this.checkStatusInterval);
    }
}

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
        if (!this.survive) {
            throw new Error("cannot trigger heartBeat to a dead session.");
        }
        this.lastHeartBeat = Date.now();
        return this;
    }


}

export class WSServer {

    protected _log: Logger;
    public get log(): Logger {
        return this._log || (this._log = genLogger());
    }

    protected sessions: UserSessionFactory;
    protected io: socketIo.Server;

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
            this.sessions = new UserSessionFactory(this.io, this.heartbeatTimeOut, this.checkStatusInterval);
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

            const session = this.sessions.create(socket.id, uid);
            socket.emit("login", "SUCCESS");

            socket.on("message", (message: string) => {
                this.callback(socket, uid, message);
            });

            socket.on("disconnect", (message: string) => {
                this.sessions.remove(uid);
            });

            socket.on("heartbeat", (message: string) => {
                if (this.sessions.heartBeat(uid)) {
                    this.sessions.get(uid).emit("heartbeat");
                }
            });

            this.log.info(`ws connected, socket id : ${socket.id}`);
        });

        return this.io;
    }

    public emit(uid: string, message: any): this {
        const session = this.sessions.get(uid);
        if (!session) {
            this.log.error(`try emit message to uid ${uid}, but the session are not found`);
        }
        if (session.survive) {
            this.log.error(`try emit message to uid ${uid}, but the session are not survive`);
        }
        session.emit("message", message); // todo: ???
        return this;
    }

    public emitToUsers(uids: string[], message: any): this {
        (uids || []).forEach(uid => this.emit(uid, message));
        return this;
    }

    public emitToAll(message: any): this {
        this.io.emit(message);
        return this;
    }

    private checkStatus() {
        this.sessions.evictInactive();
    }
}
