import type { z } from "zod";
import { DislikeSchema, LikeSchema } from "../../schemas/extensions/likes.ts";
import type { JSONObject } from "../../types.ts";
import { Entity } from "../entity.ts";

export class Like extends Entity {
    public static override name = "pub.versia:likes/Like";

    public constructor(public override data: z.infer<typeof LikeSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Like> {
        return LikeSchema.parseAsync(json).then((u) => new Like(u));
    }
}

export class Dislike extends Entity {
    public static override name = "pub.versia:likes/Dislike";

    public constructor(public override data: z.infer<typeof DislikeSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Dislike> {
        return DislikeSchema.parseAsync(json).then((u) => new Dislike(u));
    }
}
