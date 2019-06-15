import {turtle, EasyHealth} from "../../src/";

async function startEasyHealth() {
    turtle.conf = {
        name: "easyHealthExample",
        id: 0,
        port: [ 8001, 8002, 8003, 8004, 8005],
        drivers: {
            "discover/consul": {
                health: {
                    api: "api/health"
                }
            }
        }
    };
    await turtle.initialDrivers(["discover/consul"]);
    return turtle.startAll(new EasyHealth());
}

startEasyHealth().then(() => {
    console.log("service started");
});

