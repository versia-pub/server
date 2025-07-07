import type { z } from "zod/v4";
import { ShareSchema } from "../../schemas/extensions/share.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Share extends Entity {
    public static override name = "pub.versia:share/Share";

    public constructor(public override data: z.infer<typeof ShareSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Share> {
        return ShareSchema.parseAsync(json).then((u) => new Share(u));
    }
}
