import {Target, Method} from "@khgame/jsonrpc/lib";
import {turtle} from "./index";

@Target("turtle")
export class CommandsAPI {

    @Method()
    async reload() {
        turtle.reloadConf();
    }
}



