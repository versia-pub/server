import type { z } from "zod";
import { ReactionSchema } from "../../schemas/extensions/reactions.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Reaction extends Entity {
    public static override name = "pub.versia:reactions/Reaction";

    public constructor(public override data: z.infer<typeof ReactionSchema>) {
        super(data);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author);
    }

    public get object(): Reference {
        return Reference.fromString(this.data.object);
    }

    public static override fromJSON(json: JSONObject): Promise<Reaction> {
        return ReactionSchema.parseAsync(json).then((u) => new Reaction(u));
    }
}
