import type { z } from "zod";
import { ReactionSchema } from "../../schemas/extensions/reactions.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Reaction extends Entity {
    public static override name = "pub.versia:reactions/Reaction";

    public constructor(
        public override data: z.infer<typeof ReactionSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get object(): Reference {
        return Reference.fromString(this.data.object, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Reaction> {
        return ReactionSchema.parseAsync(json).then(
            (u) => new Reaction(u, instanceDomain),
        );
    }
}
