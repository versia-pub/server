import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { InboxJobType, inboxQueue } from "@versia-server/kit/queues/inbox";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.post(
        "/inbox",
        describeRoute({
            summary: "Instance federation inbox",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Request processing initiated",
                },
            },
        }),
        validator(
            "header",
            z.object({
                "versia-signature": z.string().optional(),
                "versia-signed-at": z.coerce.number().optional(),
                "versia-signed-by": z
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
                ip: context.env?.ip ?? null,
            });

            return context.body(
                "Request processing initiated.\nImplement the Instance Messaging Extension to receive any eventual feedback (errors, etc.)",
                200,
            );
        },
    ),
);
