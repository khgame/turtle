export function turtleVerbose(...arr: any[]) {
    if (arr.length === 0) {
        return;
    }

    if (arr.length === 1) {
        return turtlePrint(arr[0]);
    }

    // const strs: string[] = arr.map(a => typeof a === "string" ? a : `${a}`);
    // const maxLength = strs.reduce((p, s) => s.length > p ? s.length : p, 0);
    // const __ = +"─".repeat(maxLength + 4);
    // const ___ = +" ".repeat(maxLength - 4);
    // console.log("   ┌" + __ + "┐");
    // console.log("   │ TURTLE: " + ___ + " │");
    // strs.forEach(s => {
    //     console.log("   │ - " + s + " ".repeat(maxLength - s.length) + " │");
    // });
    // console.log("   └" + __ + "┘");
}

export function turtlePrint(out: any) {
    const result = `${out}`;
    const __ = "─".repeat(result.length + 10);
    console.log("   ┌" + __ + "┐");
    console.log("   │ TURTLE: " + result + " │");
    console.log("   └" + __ + "┘");
}
