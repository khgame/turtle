import { Server } from "http";
import * as socketIo from "socket.io";
import { Logger } from "winston";
import { genLogger } from "../logger";

export class UserSessionFactory {

    protected sessionMap: { [uid: string]: UserSession } = {};

    // for session elimination
    public head: UserSession = null;
    public tail: UserSession = null;

    constructor(
        protected readonly io: socketIo.Server,
        public readonly heartbeatTimeOut: number) {
    }

    has(uid: string) {
        return this.sessionMap.hasOwnProperty(uid);
    }

    get(uid: string): UserSession {
        return this.sessionMap[uid];
    }

    create(socketId: string, uid: string): boolean {
        if (this.has(uid)) { // remove the old session
            this.remove(uid);
        }
        const session = this.sessionMap[uid] = new UserSession(this.io, socketId, uid);
        this.appendToList(session).evictInactive();
        return true; // when new session come in, evictInactive
    }

    public remove(uid: string): boolean {
        const session = this.get(uid);
        if (!session) {
            return false;
        }
        this.removeSession(session);
        return true;
    }

    public removeSession(session: UserSession): boolean {
        if (session.survive) {
            session.socket.disconnect();
        }
        this.removeFromList(session);
        delete this.sessionMap[session.uid];
        return true;
    }

    public heartBeat(uid: string) {
        const session = this.get(uid);
        if (!session) {
            return false;
        }
        session.heartBeat();
        this.removeFromList(session).appendToList(session).evictInactive(); // when session heart beats, evictInactive
        return true;
    }

    protected removeFromList(session: UserSession): this {
        const prev = session.prev;
        const next = session.next;
        if (prev) {
            prev.next = next;
        } else {
            this.head = next;
        }

        if (next) {
            next.prev = prev;
        } else {
            this.tail = prev;
        }
        session.prev = session.next = null;
        return this;
    }

    protected appendToList(session: UserSession): this {
        if (session.prev || session.next) {
            return this;
        }
        if (this.tail) {
            session.prev = this.tail;
            this.tail.next = session;
            this.tail = session;
        } else {
            this.head = this.tail = session;
        }
        return this;
    }

    public evictInactive() {
        const now = Date.now();
        while (this.head && now > this.head.lastHeartBeat + this.heartbeatTimeOut) {
            this.removeSession(this.head);
        }
    }
}

class UserSession {

    lastHeartBeat: number;

    public next: UserSession = null;
    public prev: UserSession = null;

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
        return this.io && this.io.sockets && this.io.sockets.sockets.hasOwnProperty(this.socketId);
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

    protected sessions: UserSessionFactory;
    protected io: socketIo.Server;

    constructor(public readonly server: Server,
        public readonly validateToken: (token: string) => Promise<string | undefined>,
        public readonly callback: (socket: socketIo.Socket, uid: string, message: string) => void,
        public readonly heartbeatTimeOut: number = 180000) {
        this.initial();
    }

    private mockIdSeq = 0;

    protected initial() {
        if (!require) {
            throw new Error("Cannot load WSServer. Try to install all required dependencies: socket.io, socket-controllers");
        }

        try {
            this.io = require("socket.io")(this.server);
            this.sessions = new UserSessionFactory(this.io, this.heartbeatTimeOut);
        } catch (e) {
            throw new Error("socket.io package was not found installed. Try to install it: npm install socket.io --save");
        }

        this.io.on("connection", async (socket: socketIo.Socket) => {
            this.log.info(`ws connected, socket id : ${socket.id}`);

            const token = socket.handshake.query.token;

            let uid = await this.validateToken(token);

            if (!uid) {
                socket.emit("login", "FAILED");
                uid = `mock_uid_${this.mockIdSeq++}`;
            }

            this.sessions.create(socket.id, uid);
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
