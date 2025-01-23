import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Media } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { config } from "~/packages/config-manager/index.ts";
import { ErrorSchema } from "~/types/api";

const schemas = {
    form: z.object({
        file: z.instanceof(File),
        thumbnail: z.instanceof(File).optional(),
        description: z
            .string()
            .max(config.validation.max_media_description_size)
            .optional(),
        focus: z.string().optional(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v2/media",
    summary: "Upload media",
    middleware: [
        auth({
            auth: true,
            scopes: ["write:media"],
            permissions: [RolePermissions.ManageOwnMedia],
        }),
    ] as const,
    request: {
        body: {
            content: {
                "multipart/form-data": {
                    schema: schemas.form,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Uploaded media",
            content: {
                "application/json": {
                    schema: Media.schema,
                },
            },
        },
        413: {
            description: "Payload too large",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        415: {
            description: "Unsupported media type",
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
        const { file, thumbnail, description } = context.req.valid("form");

        const attachment = await Media.fromFile(file, {
            thumbnail,
            description,
        });

        return context.json(attachment.toApi(), 200);
    }),
);
