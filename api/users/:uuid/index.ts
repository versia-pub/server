import { apiRoute, applyConfig, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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
        uuid: z.string().uuid(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");

            const user = await User.fromId(uuid);

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
                return context.redirect(user.toApi().url);
            }

            const userJson = user.toVersia();

            const { headers } = await user.sign(
                userJson,
                context.req.url,
                "GET",
            );

            return context.json(userJson, 200, headers.toJSON());
        },
    ),
);
