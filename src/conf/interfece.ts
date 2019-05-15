export interface IConf {
    name: string;
    id: string|number|Buffer;
    port?: string|number;
    drivers?: any;
    rules?: any;
}
