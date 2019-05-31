export interface IDriverAdaptor<TConf, TService> {
    init(conf: TConf): Promise<TService>;

    onApiStart?(): Promise<void>;
    onApiClose?(): Promise<void>;

    onWorkerStart?(): Promise<void>;
    onWorkerClose?(): Promise<void>;
}
