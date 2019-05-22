import {Target, Method, Server, Client} from "@khgame/jsonrpc/lib";
import {turtle} from "./index";
import * as getPort from "get-port";
import * as ip from "ip";

@Target("turtle")
export class CommandsAPI {

    @Method()
    async reload() {
        turtle.reloadConf();
    }
}

export async function listenCommands() {
    const port = await getPort({port: getPort.makeRange(13000, 13100)})
    const server = new Server();
    server.init([CommandsAPI]);
    server.listen(port);
    const url = `${ip.address()}:${port}`;
    const target = server.getTarget(CommandsAPI);
    console.log(`start commands server at ${url}, targets => ${target}`);
}

