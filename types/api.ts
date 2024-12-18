import type { OpenAPIHono } from "@hono/zod-openapi";
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
import type { RolePermissions } from "@versia/kit/tables";
import type { SocketAddress } from "bun";
import type { RouterRoute } from "hono/types";
import { z } from "zod";
import type { AuthData } from "~/classes/functions/user";
import type { Config } from "~/packages/config-manager";

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
export interface ApiRouteMetadata {
    ratelimits: {
        max: number;
        duration: number;
    };
    route: string;
    auth: {
        required: boolean;
        methodOverrides?: {
            [Key in HttpVerb]?: boolean;
        };
        oauthPermissions?: string[];
    };
    challenge?: {
        required: boolean;
        methodOverrides?: {
            [Key in HttpVerb]?: boolean;
        };
    };
    permissions?: {
        required: RolePermissions[];
        methodOverrides?: {
            [Key in HttpVerb]?: RolePermissions[];
        };
    };
}

export const ErrorSchema = z.object({
    error: z.string(),
});

export type HonoEnv = {
    Variables: {
        config: Config;
        auth: AuthData;
    };
    Bindings: {
        ip?: SocketAddress | null;
    };
};

export interface ApiRouteExports {
    meta?: ApiRouteMetadata;
    schemas?: {
        query?: z.AnyZodObject;
        body?: z.AnyZodObject;
    };
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
