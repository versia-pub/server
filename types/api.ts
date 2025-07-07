import type * as VersiaEntities from "@versia/sdk/entities";
import type { ConfigSchema } from "@versia-server/config";
import type { Application, Token, User } from "@versia-server/kit/db";
import type { SocketAddress } from "bun";
import type { Hono } from "hono";
import type { RouterRoute } from "hono/types";
import type { z } from "zod/v4";

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

export interface AuthData {
    user: User | null;
    token: Token | null;
    application: Application | null;
}

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
