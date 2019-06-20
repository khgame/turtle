import socketIo = require("socket.io");
import { Server } from "http";
import { useSocketServer } from "socket-controllers";

export class WebSocket {
    private io: socketIo.Server;
    constructor(server: Server, controllers: any[]) {
        this.io = socketIo(server);
        this.io.use((socket, next) => {
            const token = socket.handshake.query.token;
            console.log(token);
            if (token) {
                next();
            } else {
                return;
            }
        });
        useSocketServer(this.io, {
            controllers: controllers,
        });
    }
}