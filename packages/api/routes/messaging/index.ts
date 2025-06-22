import { apiRoute } from "@versia-server/kit/api";
import { federationMessagingLogger } from "@versia-server/logging";
import chalk from "chalk";
import { describeRoute } from "hono-openapi";

export default apiRoute((app) =>
    app.post(
        "/messaging",
        describeRoute({
            summary: "Endpoint for the Instance Messaging Versia Extension.",
            description: "https://versia.pub/extensions/instance-messaging.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Message saved",
                },
            },
        }),
        async (context) => {
            const content = await context.req.text();

            federationMessagingLogger.info`Received message via ${chalk.bold("Instance Messaging")}:\n${content}`;

            return context.text("", 200);
        },
    ),
);
