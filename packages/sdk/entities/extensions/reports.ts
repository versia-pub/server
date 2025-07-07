import type { z } from "zod/v4";
import { ReportSchema } from "../../schemas/extensions/reports.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Report extends Entity {
    public static override name = "pub.versia:reports/Report";

    public constructor(public override data: z.infer<typeof ReportSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Report> {
        return ReportSchema.parseAsync(json).then((u) => new Report(u));
    }
}
