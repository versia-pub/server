import { apiRoute } from "@/api";
import { getLogger } from "@logtape/logtape";
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

            getLogger(["federation", "messaging"])
                .info`Received message via ${chalk.bold("Instance Messaging")}:\n${content}`;

            return context.text("", 200);
        },
    ),
);
