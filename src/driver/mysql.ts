import {Driver, IDriverAdaptor} from "../core";
import {turtle} from "../turtle";
import {ITurtleRedis} from "./redis";

export interface IMysqlConf {
    type: "mysql" | "mariadb";
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    entities: string;
    synchronize?: boolean;
    logging?: boolean;
}

@Driver("mysql")
export class MysqlDriver implements IDriverAdaptor<IMysqlConf, any> {

    protected typeorm: any;

    public conn: any;

    protected loadMysql() {
        if (!require) {
            throw new Error("Cannot load typeorm. Try to install all required dependencies.");
        }
        if (!this.typeorm) {
            try {
                this.typeorm = require("typeorm");
            } catch (e) {
                throw new Error("typeorm package was not found installed. Try to install it: npm install typeorm --save");
            }
        }
        return this.typeorm;
    }

    public async init(conf: IMysqlConf): Promise<any> {

        const {createConnection} = this.loadMysql();

        const connection = await createConnection(conf).catch((error: Error) => {
            console.log("mysql connection error", error);
            throw error;
        });
        console.log("mysql connection established");
        return this.conn = connection;
    }
}
