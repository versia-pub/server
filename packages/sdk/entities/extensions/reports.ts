import type { z } from "zod";
import { ReportSchema } from "../../schemas/extensions/reports.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Report extends Entity {
    public static override name = "pub.versia:reports/Report";

    public constructor(public override data: z.infer<typeof ReportSchema>) {
        super(data);
    }

    public get author(): Reference | null {
        return this.data.author ? Reference.fromString(this.data.author) : null;
    }

    public get reported(): Reference[] {
        return this.data.reported.map((r) => Reference.fromString(r));
    }

    public static override fromJSON(json: JSONObject): Promise<Report> {
        return ReportSchema.parseAsync(json).then((u) => new Report(u));
    }
}
