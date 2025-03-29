import type {
    Delete,
    Follow,
    FollowAccept,
    FollowReject,
    InstanceMetadata,
    LikeExtension,
    Note,
    Unfollow,
    User,
} from "@versia/federation/types";
import type { SocketAddress } from "bun";
import type { Hono } from "hono";
import type { RouterRoute } from "hono/types";
import type { z } from "zod";
import type { ConfigSchema } from "~/classes/config/schema";
import type { AuthData } from "~/classes/functions/user";

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

export type HonoEnv = {
    Variables: {
        config: z.infer<typeof ConfigSchema>;
        auth: AuthData;
    };
    Bindings: {
        ip?: SocketAddress | null;
    };
};

export interface ApiRouteExports {
    default: (app: Hono<HonoEnv>) => RouterRoute;
}

export type KnownEntity =
    | Note
    | InstanceMetadata
    | User
    | Follow
    | FollowAccept
    | FollowReject
    | Unfollow
    | Delete
    | LikeExtension;
