import { Server } from "http";
import * as socketIo from "socket.io";

export class WSServer {

    private allUserStatus: {
        [uid: string]: {
            token: string,
            socketId: string,
            timestamp: number,
        };
    } = {};

    private io: socketIo.Server;

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
            console.log("连接成功", socket.id);

            const token = socket.handshake.query.token;
            const uid = await this.validateToken(token);
            if (!uid) {
                socket.emit("login", "FAILED");
                setTimeout(() => {
                    socket.disconnect();
                }, 1000);
                return false;
            }
            this.login(uid, socket.id, token);
            socket.emit("login", "SUCCESS");
            console.log("login成功", socket.id);

            socket.on("message", (message: string) => {
                this.callback(socket, uid, message);
            });

            socket.on("disconnect", (message: string) => {
                this.disconnect(uid);
            });
            socket.on("heartbeat", (message: string) => {
                const status = this.refreshStatus(uid, socket.id);
                if (status) {
                    socket.emit("heartbeat");
                }
            });
        });

        return this.io;
    }

    public emit(uid: string, message: any) {
        const status = this.allUserStatus[uid];
        if (!status) {
            return false;
        }
        const socket = this.getSocket(status.socketId);
        if (!socket) {
            return false;
        }
        return socket.emit("message", message);
    }

    public emitToUsers(uids: string[], message: any) {
        if (!uids || uids.length === 0) {
            return;
        }
        uids.map(u => this.emit(u, message));
    }

    public emitToAll(message: any) {
        this.io.emit(message);
    }

    constructor(public readonly server: Server,
                public readonly validateToken: (token: string) => Promise<string | undefined>,
                public readonly callback: (socket: socketIo.Socket, uid: string, message: string) => void,
                public readonly heartbeatTimeOut: number = 10000,
                public readonly checkStatusInterval = 30000) {
        this.initial();
    }
    private getSocket(socketId: string): socketIo.Socket {
        if (!this.io.sockets.sockets.hasOwnProperty(socketId)) {
            return ;
        }
        return this.io.sockets.sockets[socketId];
    }

    private disconnect(uid: string) {
        if (!this.allUserStatus[uid]) {
            return false;
        }
        const socketId = this.allUserStatus[uid].socketId;
        const socket = this.getSocket(socketId);
        if (socket) {
            socket.disconnect();
        }
        delete this.allUserStatus[uid];

        return true;
    }

    private login(uid: string, socketId: string, token: string) {
        this.disconnect(uid);
        this.allUserStatus[uid] = {
            token,
            timestamp: Date.now(),
            socketId
        };
    }

    private refreshStatus(uid: string, socketId: string) {
        const status = this.allUserStatus[uid];
        if (!status) {
            return false;
        }
        if (status.socketId !== socketId) {
            return false;
        }
        status.timestamp = Date.now();
        return true;
    }

    private checkStatus() {
        const timestamp = Date.now();
        for (const uid of Object.keys(this.allUserStatus)) {
            const userStatus = this.allUserStatus[uid];
            if (timestamp - userStatus.timestamp > this.heartbeatTimeOut) {
                this.disconnect(uid);
            }
        }
        setTimeout(() => {
            this.checkStatus();
        }, this.checkStatusInterval);
    }
}
