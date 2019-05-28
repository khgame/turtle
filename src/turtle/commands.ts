import {Target, Method, Server, Client} from "@khgame/jsonrpc/lib";
import {turtle} from "./index";
import * as getPort from "get-port";
import * as ip from "ip";
import {Runtime} from "./runtime";

@Target("turtle")
export class CommandsAPI {

    @Method()
    async reload() {
        turtle.reloadConf();
    }
}



