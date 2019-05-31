export enum APIRunningState {
    NONE = 0,
    PREPARED = 1,
    STARTING = 2,
    RUNNING = 3,
    CLOSING = 4,
    CLOSED = 5
}

export interface IApi {
    runningRequest: number;

    enabled: boolean;
    runningState: APIRunningState;

    start(port: number) : Promise<boolean>;
    close() : Promise<boolean>;
}

