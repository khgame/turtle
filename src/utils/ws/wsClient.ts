export class WSClient {

    protected _connected: boolean;
    public get connected() {
        return this._connected;
    }

    constructor(
        private url: string,
        private header: any,
        private socket?: any
    ) {
        this.initial();
    }

    protected initial() {
        if (!require) {
            throw new Error("Cannot load WSServer. Try to install all required dependencies: socket.io, socket-controllers");
        }

        try {
            this.socket = require("socket.io-client")(this.url, this.header);
            this.socket.on("connect", () => {
                this._connected = true;
            });
            this.socket.on("disconnect", () => {
                this._connected = false;
            });
        } catch (e) {
            throw new Error("socket.io package was not found installed. Try to install it: npm install socket.io --save");
        }
    }

    public on(event: string, callback: Function) {
        this.socket.on(event, callback);
    }

    public emit(event: string, message: any) {
        this.socket.emit(event, message);
    }

    public removeEvent(event: string) {
        this.socket.removeAllListeners(event);
    }
}
