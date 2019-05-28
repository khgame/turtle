export interface ISingletonFactory {
    get<T>(someClass: { new(...args: any[]): T } | Function): T;
}

export interface IClass<T> {
    new(...args: any[]): T;
}

export class SingletonFactory implements ISingletonFactory{
    private _instances: Array<{ type: Function, object: any }> = [];
    get<T>(someClass: IClass<T>| Function ): T {
        const classT = someClass as IClass<T>;
        let instance = this._instances.find(_inst => _inst.type === someClass);
        if (!instance) {
            instance = {type: someClass, object: new classT()};
            this._instances.push(instance);
        }
        return instance.object;
    }
    get instances(): Array<{ type: Function, object: any }> { return this.instances; }
}

