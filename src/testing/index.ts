import {turtle} from "../turtle";
import {IConf} from "..";

export async function createTest(drivers: Array<string | Function>, conf: IConf){
    turtle.conf = conf;
    await turtle.initialDrivers(this.drivers);
}
