import {Driver, IDriver} from "../../core";
import {turtle} from "../../turtle";
import * as Consul from "consul";

export interface IConsulConf {
    tags?: string[];
    health: {
        api: string
        interval?: string
        notes?: string
        status?: string
    };
}

@Driver("discover/consul")
export class DiscoverConsulDriver implements IDriver<IConsulConf, any> {

    protected consul: Consul.Consul;

    protected loadConsul() {
        if (!require) {
            throw new Error("Cannot load consul. Try to install all required dependencies.");
        }
        if (!this.consul) {
            try {
                this.consul = require("consul")();
            } catch (e) {
                throw new Error("consul package was not found installed. Try to install it: npm install consul --save");
            }
        }
        return this.consul;
    }

    async init(conf: IConsulConf): Promise<any> {

        const consul = this.loadConsul();

        const check = {
            http: `http://localhost:${turtle.conf.port}/${conf.health.api}`,
            interval: conf.health.interval || "5s",
            notes: conf.health.notes,
            status: conf.health.status
        };
        consul.agent.service.register({
                id: `${turtle.conf.name}-${turtle.conf.id}`,
                name: turtle.conf.name,
                tags: conf.tags,
                check
            },
            (err) => {
                if (err) {
                    throw err;
                }
            }
        );

        return consul;
    }
}



