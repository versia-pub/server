import { apiRoute, applyConfig } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import type { Entity } from "@versia/federation/types";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";
import { InboxJobType, inboxQueue, inboxWorker } from "~/worker";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid/inbox",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
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
    path: "/users/{uuid}/inbox",
    summary: "Receive federation inbox",
    request: {
        params: schemas.param,
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
            description: "Request processed",
        },
        201: {
            description: "Request accepted",
        },
        400: {
            description: "Bad request",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        401: {
            description: "Signature could not be verified",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Cannot view users from remote instances",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        500: {
            description: "Internal server error",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string(),
                        message: z.string(),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const body: Entity = await context.req.valid("json");

        const result = await inboxQueue.add(InboxJobType.ProcessEntity, {
            data: body,
            headers: context.req.valid("header"),
            request: {
                body: await context.req.text(),
                method: context.req.method,
                url: context.req.url,
            },
            ip: context.env.ip ?? null,
        });

        return new Promise<Response>((resolve, reject) => {
            inboxWorker.on("completed", (job) => {
                if (job.id === result.id) {
                    resolve(job.returnvalue);
                }
            });

            inboxWorker.on("failed", (job) => {
                if (job && job.id === result.id) {
                    reject(job.returnvalue);
                }
            });
        });
    }),
);
