import type { SocketAddress } from "bun";
import type { Hono } from "hono";
import type { RouterRoute } from "hono/types";
import type { z } from "zod";
import type { ConfigSchema } from "~/classes/config/schema";
import type { AuthData } from "~/classes/functions/user";
import type * as VersiaEntities from "~/packages/sdk/entities";

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
    | VersiaEntities.Note
    | VersiaEntities.InstanceMetadata
    | VersiaEntities.User
    | VersiaEntities.Follow
    | VersiaEntities.FollowAccept
    | VersiaEntities.FollowReject
    | VersiaEntities.Unfollow
    | VersiaEntities.Delete
    | VersiaEntities.Like
    | VersiaEntities.Share
    | VersiaEntities.Reaction;
