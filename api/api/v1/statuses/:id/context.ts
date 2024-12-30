import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 8,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/context",
    auth: {
        required: false,
    },
    permissions: {
        required: [RolePermissions.ViewNotes],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}/context",
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewNotes],
        }),
    ] as const,
    summary: "Get status context",
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Status context",
            content: {
                "application/json": {
                    schema: z.object({
                        ancestors: z.array(Note.schema),
                        descendants: z.array(Note.schema),
                    }),
                },
            },
        },
        404: {
            description: "Record not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const { user } = context.get("auth");

        const foundStatus = await Note.fromId(id, user?.id);

        if (!foundStatus) {
            throw new ApiError(404, "Note not found");
        }

        const ancestors = await foundStatus.getAncestors(user ?? null);

        const descendants = await foundStatus.getDescendants(user ?? null);

        return context.json(
            {
                ancestors: await Promise.all(
                    ancestors.map((status) => status.toApi(user)),
                ),
                descendants: await Promise.all(
                    descendants.map((status) => status.toApi(user)),
                ),
            },
            200,
        );
    }),
);
