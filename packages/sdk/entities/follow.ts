import type { z } from "zod";
import {
    FollowAcceptSchema,
    FollowRejectSchema,
    FollowSchema,
    UnfollowSchema,
} from "../schemas/follow.ts";
import type { JSONObject } from "../types.ts";
import { Entity, Reference } from "./entity.ts";

export class Follow extends Entity {
    public static override name = "Follow";

    public constructor(
        public override data: z.infer<typeof FollowSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get followee(): Reference {
        return Reference.fromString(this.data.followee, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Follow> {
        return FollowSchema.parseAsync(json).then(
            (u) => new Follow(u, instanceDomain),
        );
    }
}

export class FollowAccept extends Entity {
    public static override name = "FollowAccept";

    public constructor(
        public override data: z.infer<typeof FollowAcceptSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get follower(): Reference {
        return Reference.fromString(this.data.follower, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<FollowAccept> {
        return FollowAcceptSchema.parseAsync(json).then(
            (u) => new FollowAccept(u, instanceDomain),
        );
    }
}

export class FollowReject extends Entity {
    public static override name = "FollowReject";

    public constructor(
        public override data: z.infer<typeof FollowRejectSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get follower(): Reference {
        return Reference.fromString(this.data.follower, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<FollowReject> {
        return FollowRejectSchema.parseAsync(json).then(
            (u) => new FollowReject(u, instanceDomain),
        );
    }
}

export class Unfollow extends Entity {
    public static override name = "Unfollow";

    public constructor(
        public override data: z.infer<typeof UnfollowSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get followee(): Reference {
        return Reference.fromString(this.data.followee, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Unfollow> {
        return UnfollowSchema.parseAsync(json).then(
            (u) => new Unfollow(u, instanceDomain),
        );
    }
}
