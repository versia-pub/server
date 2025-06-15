import { ApiError } from "@versia/kit";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, handleZodError } from "@/api";
import { InboxJobType, inboxQueue } from "~/classes/queues/inbox";

export default apiRoute((app) =>
    app.post(
        "/users/:uuid/inbox",
        describeRoute({
            summary: "Receive federation inbox",
            tags: ["Federation"],
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
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                401: {
                    description: "Signature could not be verified",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                403: {
                    description: "Cannot view users from remote instances",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                404: {
                    description: "Not found",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                500: {
                    description: "Internal server error",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.object({
                                    error: z.string(),
                                    message: z.string(),
                                }),
                            ),
                        },
                    },
                },
            },
        }),
        validator(
            "param",
            z.object({
                uuid: z.string().uuid(),
            }),
            handleZodError,
        ),
        validator(
            "header",
            z.object({
                "versia-signature": z.string().optional(),
                "versia-signed-at": z.coerce.number().optional(),
                "versia-signed-by": z
                    .string()
                    .url()
                    .or(z.string().startsWith("instance "))
                    .optional(),
                authorization: z.string().optional(),
            }),
            handleZodError,
        ),
        async (context) => {
            const body = await context.req.json();
            const {
                "versia-signature": signature,
                "versia-signed-at": signedAt,
                "versia-signed-by": signedBy,
                authorization,
            } = context.req.valid("header");

            await inboxQueue.add(InboxJobType.ProcessEntity, {
                data: body,
                headers: {
                    "versia-signature": signature,
                    "versia-signed-at": signedAt,
                    "versia-signed-by": signedBy,
                    authorization,
                },
                request: {
                    body: await context.req.text(),
                    method: context.req.method,
                    url: context.req.url,
                },
                ip: context.env.ip ?? null,
            });

            return context.body(
                "Request processing initiated.\nImplement the Instance Messaging Extension to receive any eventual feedback (errors, etc.)",
                200,
            );
        },
    ),
);
