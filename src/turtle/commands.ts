import {Target, Method} from "@khgame/jsonrpc/lib";
import {turtle} from "./index";

@Target("turtle")
export class CommandsAPI {

    @Method()
    async reload() {
        await turtle.reload();
    }

    @Method()
    async shutdown() {
        await turtle.shutdown();
    }

    @Method()
    async runtime() {
        await turtle.runtime;
    }
}



