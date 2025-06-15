import { config } from "@versia-server/config";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { User } from "@versia-server/kit/db";
import { Users } from "@versia-server/kit/tables";
import { password as bunPassword } from "bun";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { z } from "zod";

const returnError = (
    context: Context,
    token: string,
    error: string,
    description: string,
): Response => {
    const searchParams = new URLSearchParams();

    searchParams.append("error", error);
    searchParams.append("error_description", description);
    searchParams.append("token", token);

    return context.redirect(
        new URL(
            `${
                config.frontend.routes.password_reset
            }?${searchParams.toString()}`,
            config.http.base_url,
        ).toString(),
    );
};

export default apiRoute((app) =>
    app.post(
        "/api/auth/reset",
        describeRoute({
            summary: "Reset password",
            description: "Reset password",
            responses: {
                302: {
                    description:
                        "Redirect to the password reset page with a message",
                },
            },
        }),
        validator(
            "form",
            z.object({
                token: z.string().min(1),
                password: z.string().min(3).max(100),
            }),
            handleZodError,
        ),
        async (context) => {
            const { token, password } = context.req.valid("form");

            const user = await User.fromSql(
                eq(Users.passwordResetToken, token),
            );

            if (!user) {
                return returnError(
                    context,
                    token,
                    "invalid_token",
                    "Invalid token",
                );
            }

            await user.update({
                password: await bunPassword.hash(password),
                passwordResetToken: null,
            });

            return context.redirect(
                `${config.frontend.routes.password_reset}?success=true`,
            );
        },
    ),
);
