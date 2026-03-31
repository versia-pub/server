import type { z } from "zod";
import { ShareSchema } from "../../schemas/extensions/share.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Share extends Entity {
    public static override name = "pub.versia:share/Share";

    public constructor(public override data: z.infer<typeof ShareSchema>) {
        super(data);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author);
    }

    public get shared(): Reference {
        return Reference.fromString(this.data.shared);
    }

    public static override fromJSON(json: JSONObject): Promise<Share> {
        return ShareSchema.parseAsync(json).then((u) => new Share(u));
    }
}
