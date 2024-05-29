import { applyConfig, handleZodError } from "@/api";
import { response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/auth/reset",
    auth: {
        required: false,
    },
});

export const schemas = {
    form: z.object({
        token: z.string().min(1),
        password: z.string().min(3).max(100),
        password2: z.string().min(3).max(100),
    }),
};

const returnError = (token: string, error: string, description: string) => {
    const searchParams = new URLSearchParams();

    searchParams.append("error", error);
    searchParams.append("error_description", description);
    searchParams.append("token", token);

    return response(null, 302, {
        Location: new URL(
            `${
                config.frontend.routes.password_reset
            }?${searchParams.toString()}`,
            config.http.base_url,
        ).toString(),
    });
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("form", schemas.form, handleZodError),
        async (context) => {
            const { token, password, password2 } = context.req.valid("form");

            const user = await User.fromSql(
                eq(Users.passwordResetToken, token),
            );

            if (!user) {
                return returnError(token, "invalid_token", "Invalid token");
            }

            if (password !== password2) {
                return returnError(
                    token,
                    "password_mismatch",
                    "Passwords do not match",
                );
            }

            await user.update({
                password: await Bun.password.hash(password),
                passwordResetToken: null,
            });

            return response(null, 302, {
                Location: `${config.frontend.routes.password_reset}?success=true`,
            });
        },
    );
