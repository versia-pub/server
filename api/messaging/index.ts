import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { getLogger } from "@logtape/logtape";
import chalk from "chalk";

const route = createRoute({
    method: "post",
    path: "/messaging",
    summary: "Endpoint for the Instance Messaging Versia Extension.",
    description: "https://versia.pub/extensions/instance-messaging.",
    request: {
        body: {
            content: {
                "text/plain": {
                    schema: z.string(),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Message saved",
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const content = await context.req.text();

        getLogger(["federation", "messaging"])
            .info`Received message via ${chalk.bold("Instance Messaging")}:\n${content}`;

        return context.text("", 200);
    }),
);
