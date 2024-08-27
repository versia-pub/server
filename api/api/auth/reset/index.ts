import { apiRoute, applyConfig } from "@/api";
import { response } from "@/response";
import { createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
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

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { token, password } = context.req.valid("form");

        const user = await User.fromSql(eq(Users.passwordResetToken, token));

        if (!user) {
            return returnError(token, "invalid_token", "Invalid token");
        }

        await user.update({
            password: await Bun.password.hash(password),
            passwordResetToken: null,
        });

        return response(null, 302, {
            Location: `${config.frontend.routes.password_reset}?success=true`,
        });
    }),
);
