import { apiRoute, applyConfig } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import type { Entity } from "@versia/federation/types";
import { z } from "zod";
import { InboxJobType, inboxQueue } from "~/classes/queues/inbox";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/inbox",
});

export const schemas = {
    header: z.object({
        "x-signature": z.string().optional(),
        "x-nonce": z.string().optional(),
        "x-signed-by": z
            .string()
            .url()
            .or(z.string().startsWith("instance "))
            .optional(),
        authorization: z.string().optional(),
    }),
    body: z.any(),
};

const route = createRoute({
    method: "post",
    path: "/inbox",
    summary: "Instance federation inbox",
    request: {
        headers: schemas.header,
        body: {
            content: {
                "application/json": {
                    schema: schemas.body,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Request processing initiated",
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const body: Entity = await context.req.valid("json");

        await inboxQueue.add(InboxJobType.ProcessEntity, {
            data: body,
            headers: context.req.valid("header"),
            request: {
                body: await context.req.text(),
                method: context.req.method,
                url: context.req.url,
            },
            ip: context.env.ip ?? null,
        });

        return context.newResponse(
            "Request processing initiated.\nImplement the Instance Messaging Extension to receive any eventual feedback (errors, etc.)",
            200,
        );
    }),
);
