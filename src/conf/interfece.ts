export interface IConf {
    name: string;
    id: string|number|Buffer;
    port?: number | number[];
    drivers?: any;
    rules?: any;
}
