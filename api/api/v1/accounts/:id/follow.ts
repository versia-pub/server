import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Relationship } from "~/packages/database-interface/relationship";
import { User } from "~/packages/database-interface/user";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/follow",
    auth: {
        required: true,
        oauthPermissions: ["write:follows"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnFollows,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
            reblogs: z.coerce.boolean().optional(),
            notify: z.coerce.boolean().optional(),
            languages: z
                .array(z.enum(ISO6391.getAllCodes() as [string, ...string[]]))
                .optional(),
        })
        .optional()
        .default({ reblogs: true, notify: false, languages: [] }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/follow",
    summary: "Follow user",
    description: "Follow a user",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "User followed",
            content: {
                "application/json": {
                    schema: Relationship.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
    request: {
        params: schemas.param,
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");
        const { reblogs, notify, languages } = context.req.valid("json");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            return context.json({ error: "User not found" }, 404);
        }

        let relationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        if (!relationship.data.following) {
            relationship = await user.followRequest(otherUser, {
                reblogs,
                notify,
                languages,
            });
        }

        return context.json(relationship.toApi(), 200);
    }),
);
