import type { z } from "zod";
import { ReactionSchema } from "../../schemas/extensions/reactions.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Reaction extends Entity {
    public static override name = "pub.versia:reactions/Reaction";

    public constructor(public override data: z.infer<typeof ReactionSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Reaction> {
        return ReactionSchema.parseAsync(json).then((u) => new Reaction(u));
    }
}
