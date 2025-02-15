import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
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
import type { RouterRoute } from "hono/types";
import type { ConfigSchema } from "~/classes/config/schema";
import type { AuthData } from "~/classes/functions/user";

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

export const ErrorSchema = z.object({
    error: z.string(),
});

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
    default: (app: OpenAPIHono<HonoEnv>) => RouterRoute;
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
