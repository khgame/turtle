
export interface IDriverMetadata {
    target: Function;
    name?: string;
}

export class DriverMetaMgr{
    driverMetas: IDriverMetadata[] = [];

    pickDrivers(constructors: Function[]): IDriverMetadata[] {
        return this.driverMetas.filter(dm => constructors.indexOf(dm.target) > -1);
    }

    register(target: Function, name?: string){
        this.driverMetas.push({ target, name});
    }
}

export const driverMetaMgr : DriverMetaMgr = new DriverMetaMgr();
