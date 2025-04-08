import type { z } from "zod";
import { ShareSchema } from "../../schemas/extensions/share.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Share extends Entity {
    public static name = "pub.versia:share/Share";

    public constructor(public data: z.infer<typeof ShareSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Share> {
        return ShareSchema.parseAsync(json).then((u) => new Share(u));
    }
}
