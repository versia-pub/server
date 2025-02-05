import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { config } from "~/packages/config-manager";

const schemas = {
    form: z.object({
        token: z.string().min(1),
        password: z.string().min(3).max(100),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/auth/reset",
    summary: "Reset password",
    description: "Reset password",
    responses: {
        302: {
            description: "Redirect to the password reset page with a message",
        },
    },
    request: {
        body: {
            content: {
                "application/x-www-form-urlencoded": {
                    schema: schemas.form,
                },
                "multipart/form-data": {
                    schema: schemas.form,
                },
            },
        },
    },
});

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
    app.openapi(route, async (context) => {
        const { token, password } = context.req.valid("form");

        const user = await User.fromSql(eq(Users.passwordResetToken, token));

        if (!user) {
            return returnError(
                context,
                token,
                "invalid_token",
                "Invalid token",
            );
        }

        await user.update({
            password: await Bun.password.hash(password),
            passwordResetToken: null,
        });

        return context.redirect(
            `${config.frontend.routes.password_reset}?success=true`,
        );
    }),
);
