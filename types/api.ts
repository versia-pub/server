import type { RouterRoute } from "@hono/hono/types";
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
import { z } from "zod";
import type { Application } from "~/classes/functions/application";
import type { RolePermissions } from "~/drizzle/schema";
import type { Config } from "~/packages/config-manager";
import type { User as DatabaseUser } from "~/packages/database-interface/user";

export type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
export interface ApiRouteMetadata {
    allowedMethods: HttpVerb[];
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
        auth: {
            user: DatabaseUser | null;
            token: string | null;
            application: Application | null;
        };
    };
};

export interface ApiRouteExports {
    meta: ApiRouteMetadata;
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
