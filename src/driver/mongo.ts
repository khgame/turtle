import {Driver, IDriverAdaptor} from "../core";
import {ConnectionOptions} from "mongoose";

export interface IMongoConf {
    host: string;
    port?: string | number;
    database: string;
    username?: string;
    password?: string;
    options?: ConnectionOptions;
}

@Driver("mongo")
export class MongoDriver implements IDriverAdaptor<IMongoConf, any> {

    protected mongoose: any;

    protected loadMongoose() {
        if (!require) {
            throw new Error("Cannot load mongoose. Try to install all required dependencies.");
        }
        if (!this.mongoose) {
            try {
                this.mongoose = require("mongoose");
            } catch (e) {
                throw new Error("mongoose package was not found installed. Try to install it: npm install mongoose --save");
            }
        }
        return this.mongoose;
    }

    public async init(conf: IMongoConf): Promise<any> {
        return await new Promise((resolve, reject) => {
            const {host, port, database, username, password} = conf;
            const authStr = username ? `${username}${password ? ":" + password : ""}@` : "";
            const mongodbUrl = `mongodb://${authStr}${host}${port ? ":" + port : ""}/${database || "khgame_login_svr"}`;
            const mongoose = this.loadMongoose();
            mongoose.connect(mongodbUrl, {useNewUrlParser: true, ... (conf.options || {})});
            mongoose.connection.on("connected", (err: any) => {
                console.log("Mongoose connection open to " + mongodbUrl);
                resolve(mongoose);
            });
            mongoose.connection.on("error", (err: any) => {
                console.log("Mongoose connection error to " + mongodbUrl);
                reject(err);
            });
            mongoose.connection.on("disconnected", (err: any) => {
                console.log("Mongoose connection disconnected to " + mongodbUrl);
                reject(err);
            });
        });
    }
}
