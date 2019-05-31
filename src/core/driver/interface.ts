export interface IDriverAdaptor<TConf, TService> {
    init(conf: TConf): Promise<TService>;
    onStart?(): Promise<void>;
    onClose?(): Promise<void>;
}
