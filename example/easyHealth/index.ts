import {turtle, EasyHealth} from "../../src/";

async function startEasyHealth() {
    turtle.conf = {
        name: "easyHealthExample",
        id: 0,
        port: [8001, 8002, 8003, 8004, 8005],
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

/**
 * or:
 *   EasyHealth.FastRun("easyHealthExample_FastRun", [12001, 12002, 12003, 12004]).then(() => {
 *       console.log("service started");
 *   });
 */
