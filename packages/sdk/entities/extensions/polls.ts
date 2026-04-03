import type { z } from "zod";
import { VoteSchema } from "../../schemas/extensions/polls.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Vote extends Entity {
    public static override name = "pub.versia:polls/Vote";

    public constructor(
        public override data: z.infer<typeof VoteSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get poll(): Reference {
        return Reference.fromString(this.data.poll, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Vote> {
        return VoteSchema.parseAsync(json).then(
            (u) => new Vote(u, instanceDomain),
        );
    }
}
