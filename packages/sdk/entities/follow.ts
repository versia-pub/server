import type { z } from "zod";
import {
    FollowAcceptSchema,
    FollowRejectSchema,
    FollowSchema,
    UnfollowSchema,
} from "../schemas/follow.ts";
import type { JSONObject } from "../types.ts";
import { Entity } from "./entity.ts";

export class Follow extends Entity {
    public static override name = "Follow";

    public constructor(public override data: z.infer<typeof FollowSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Follow> {
        return FollowSchema.parseAsync(json).then((u) => new Follow(u));
    }
}

export class FollowAccept extends Entity {
    public static override name = "FollowAccept";

    public constructor(
        public override data: z.infer<typeof FollowAcceptSchema>,
    ) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<FollowAccept> {
        return FollowAcceptSchema.parseAsync(json).then(
            (u) => new FollowAccept(u),
        );
    }
}

export class FollowReject extends Entity {
    public static override name = "FollowReject";

    public constructor(
        public override data: z.infer<typeof FollowRejectSchema>,
    ) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<FollowReject> {
        return FollowRejectSchema.parseAsync(json).then(
            (u) => new FollowReject(u),
        );
    }
}

export class Unfollow extends Entity {
    public static override name = "Unfollow";

    public constructor(public override data: z.infer<typeof UnfollowSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Unfollow> {
        return UnfollowSchema.parseAsync(json).then((u) => new Unfollow(u));
    }
}
