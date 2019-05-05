import * as Path from "path";
import * as glob from "glob";

function loadFunctionsInFile (exported: any, allLoaded: Function[] = []) {
    if (exported instanceof Function) {
        allLoaded.push(exported);
    } else if (exported instanceof Array) {
        exported.forEach((e: any) => loadFunctionsInFile(e, allLoaded));
    } else if (exported instanceof Object || typeof exported === "object") {
        Object.keys(exported).forEach(key => loadFunctionsInFile(exported[key], allLoaded));
    }
    return allLoaded;
};

export function importClasses(directories: string[], formats = [".js", ".ts"]): Function[] {
    const allFiles = directories.reduce(
        (allDirs: string[], dir) => {
        return allDirs.concat(glob.sync(Path.resolve(dir, "*")));
    }, [] as string[]).filter(file => {
        const dtsExtension = file.substring(file.length - 5, file.length);
        return formats.indexOf(Path.extname(file)) !== -1 && dtsExtension !== ".d.ts";
    });

    const exports = allFiles
        .map(file => require(file));
    const functions = loadFunctionsInFile(exports);
    return functions;
}
