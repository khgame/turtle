export interface ISetting {
    log_prod_file?: "debug" | "verbose" | "info" | "warn" | "error";
    log_prod_console?: "info" | "warn" | "error";
}

export interface IConf {
    name: string;
    id: string|number|Buffer;
    port?: number | number[];
    drivers?: any;
    rules?: any;
    setting?: ISetting;
}
