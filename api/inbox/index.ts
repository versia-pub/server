import { apiRoute, handleZodError } from "@/api";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { z } from "zod";
import { InboxJobType, inboxQueue } from "~/classes/queues/inbox";

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
        validator("json", z.any(), handleZodError),
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
            const body = await context.req.valid("json");

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

            return context.body(
                "Request processing initiated.\nImplement the Instance Messaging Extension to receive any eventual feedback (errors, etc.)",
                200,
            );
        },
    ),
);
