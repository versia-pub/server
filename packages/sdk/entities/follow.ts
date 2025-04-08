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
    public static name = "Follow";

    public constructor(public data: z.infer<typeof FollowSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Follow> {
        return FollowSchema.parseAsync(json).then((u) => new Follow(u));
    }
}

export class FollowAccept extends Entity {
    public static name = "FollowAccept";

    public constructor(public data: z.infer<typeof FollowAcceptSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<FollowAccept> {
        return FollowAcceptSchema.parseAsync(json).then(
            (u) => new FollowAccept(u),
        );
    }
}

export class FollowReject extends Entity {
    public static name = "FollowReject";

    public constructor(public data: z.infer<typeof FollowRejectSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<FollowReject> {
        return FollowRejectSchema.parseAsync(json).then(
            (u) => new FollowReject(u),
        );
    }
}

export class Unfollow extends Entity {
    public static name = "Unfollow";

    public constructor(public data: z.infer<typeof UnfollowSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Unfollow> {
        return UnfollowSchema.parseAsync(json).then((u) => new Unfollow(u));
    }
}
