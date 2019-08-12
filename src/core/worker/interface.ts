export enum WorkerRunningState {
    NONE = 0,
    PREPARED = 1,
    STARTING = 2,
    RUNNING = 3,
    CLOSING = 4,
    CLOSED = 5
}

export interface IWorker {

    name: string;

    enabled: boolean;

    canBeShutdown: boolean; // not in use yet

    processRunning: number;

    runningState: WorkerRunningState;

    start() : Promise<boolean>;
    shutdown() : Promise<boolean>;

    onStart() : Promise<boolean>;
}
