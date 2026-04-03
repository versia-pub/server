import type { z } from "zod";
import { ShareSchema } from "../../schemas/extensions/share.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Share extends Entity {
    public static override name = "pub.versia:share/Share";

    public constructor(
        public override data: z.infer<typeof ShareSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get shared(): Reference {
        return Reference.fromString(this.data.shared, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Share> {
        return ShareSchema.parseAsync(json).then(
            (u) => new Share(u, instanceDomain),
        );
    }
}
