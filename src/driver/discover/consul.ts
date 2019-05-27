import * as Consul from "consul";
import {Driver, IDriver} from "../../core";
import {turtle} from "../../turtle";

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

    async init(conf: IConsulConf): Promise<any> {

        const consul = Consul();

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



