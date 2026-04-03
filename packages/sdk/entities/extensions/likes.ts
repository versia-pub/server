import type { z } from "zod";
import { DislikeSchema, LikeSchema } from "../../schemas/extensions/likes.ts";
import type { JSONObject } from "../../types.ts";
import { Entity, Reference } from "../entity.ts";

export class Like extends Entity {
    public static override name = "pub.versia:likes/Like";

    public constructor(
        public override data: z.infer<typeof LikeSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get liked(): Reference {
        return Reference.fromString(this.data.liked, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Like> {
        return LikeSchema.parseAsync(json).then(
            (u) => new Like(u, instanceDomain),
        );
    }
}

export class Dislike extends Entity {
    public static override name = "pub.versia:likes/Dislike";

    public constructor(
        public override data: z.infer<typeof DislikeSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get disliked(): Reference {
        return Reference.fromString(this.data.disliked, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Dislike> {
        return DislikeSchema.parseAsync(json).then(
            (u) => new Dislike(u, instanceDomain),
        );
    }
}
