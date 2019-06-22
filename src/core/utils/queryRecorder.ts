export class QueryRecorder {

    records: any = {};
    statistic: any = {};

    setSlot(queryName: string, timeCostMs: number) {
        const ms = Date.now();
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(s / 60);
        (new Date()).getDay();
        this.records[m] = this.records[m] || {};
        this.records[m][queryName] = (this.records[m][queryName] || {});
        this.records[m][queryName]["timeCostMs"] = timeCostMs + (this.records[m][queryName]["timeCostMs"] || 0);
        this.records[m][queryName]["count"] = 1 + (this.records[s][queryName]["count"] || 0);
    }

    pulse(queryName: string, timeCostMs: number) {
        this.setSlot(queryName, timeCostMs);
    }
}
