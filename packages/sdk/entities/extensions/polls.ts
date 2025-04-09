import type { z } from "zod";
import { VoteSchema } from "../../schemas/extensions/polls.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Vote extends Entity {
    public static name = "pub.versia:polls/Vote";

    public constructor(public data: z.infer<typeof VoteSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Vote> {
        return VoteSchema.parseAsync(json).then((u) => new Vote(u));
    }
}
