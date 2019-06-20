import {Server} from "http";
import {Socket} from "socket.io";

export class WSServer {

    protected initial() {
        if (!require) {
            throw new Error("Cannot load WSServer. Try to install all required dependencies: socket.io, socket-controllers");
        }

        let io;
        try {
            io = require("socket.io")(this.server);
        } catch (e) {
            throw new Error("socket.io package was not found installed. Try to install it: npm install socket.io --save");
        }

        let useSocketServer;
        try {
            useSocketServer = require("socket-controllers").useSocketServer;
        } catch (e) {
            throw new Error("socket-controllers package was not found installed. Try to install it: npm install socket-controllers --save");
        }

        io.use((socket: Socket, next: (err?: any) => void) => {
            const token = socket.handshake.query.token;
            if (token) {
                next();
            } else {
                return;
            }
        });

        useSocketServer(io, {
            controllers: this.controllers,
        });

        return io;
    }

    constructor(public readonly server: Server, public readonly controllers: any[]) {
        this.initial();
    }
}
