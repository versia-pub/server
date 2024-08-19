import { apiRoute, applyConfig, handleZodError } from "@/api";
import { redirect, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { config } from "~/packages/config-manager";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid().or(z.literal("actor")),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");

            const user =
                uuid === "actor"
                    ? User.getServerActor()
                    : await User.fromId(uuid);

            if (!user) {
                return context.json({ error: "User not found" }, 404);
            }

            if (user.isRemote()) {
                return context.json(
                    { error: "Cannot view users from remote instances" },
                    403,
                );
            }

            // Try to detect a web browser and redirect to the user's profile page
            if (
                context.req.header("user-agent")?.includes("Mozilla") &&
                uuid !== "actor"
            ) {
                return redirect(user.toApi().url);
            }

            const userString = JSON.stringify(user.toVersia());

            // If base_url uses https and request uses http, rewrite request to use https
            // This fixes reverse proxy errors
            const reqUrl = new URL(context.req.url);
            if (
                new URL(config.http.base_url).protocol === "https:" &&
                reqUrl.protocol === "http:"
            ) {
                reqUrl.protocol = "https:";
            }

            const { headers } = await user.sign(user.toVersia(), reqUrl, "GET");

            return response(userString, 200, {
                "Content-Type": "application/json",
                ...headers.toJSON(),
            });
        },
    ),
);
