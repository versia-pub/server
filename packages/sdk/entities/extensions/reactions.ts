import type { z } from "zod";
import { ReactionSchema } from "../../schemas/extensions/reactions.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Reaction extends Entity {
    public static name = "pub.versia:reactions/Reaction";

    public constructor(public data: z.infer<typeof ReactionSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Reaction> {
        return ReactionSchema.parseAsync(json).then((u) => new Reaction(u));
    }
}
