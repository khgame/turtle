export enum WorkerRunningState {
    NONE = 0,
    PREPARED = 1,
    STARTING = 2,
    RUNNING = 3,
    CLOSING = 4,
    CLOSED = 5
}

export interface IWorker {
    enabled: boolean;
    runningState: WorkerRunningState;

    start() : Promise<boolean>;
    close() : Promise<boolean>;

    onStart() : Promise<boolean>;
    onClose() : Promise<boolean>;
}
