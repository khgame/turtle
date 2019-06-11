export function turtleVerbose(title: string, ...arr: any[]) {
    const strs: string[] = arr.map(a => typeof a === "string" ? a : `${a}`);
    const maxLength = strs.reduce((p, s) => s.length > p ? s.length : p, 8 + title.length);

    console.log("   ┌─TURTLE: " + title + " " + "┄".repeat(maxLength - 4 - title.length) + "┐");
    // console.log("   │ TURTLE: " + title + " ".repeat(maxLength - 4 - title.length) + " │");
    strs.forEach(s => {
        console.log("   ┆ ⊙ " + s + " ".repeat(maxLength + 2 - s.length) + " ┆");
    });
    console.log("   └─┴┄┈" + " ".repeat(maxLength) + "┈┄┘");
}

export function turtlePrint(out: any) {
    const result = `${out}`;
    const __ = "─".repeat(result.length + 10);
    console.log("   ┌" + __ + "┐");
    console.log("   │ TURTLE: " + result + " │");
    console.log("   └" + __ + "┘");
}
