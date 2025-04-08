import type { z } from "zod";
import { ReportSchema } from "../../schemas/extensions/reports.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Report extends Entity {
    public static name = "pub.versia:reports/Report";

    public constructor(public data: z.infer<typeof ReportSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Report> {
        return ReportSchema.parseAsync(json).then((u) => new Report(u));
    }
}
