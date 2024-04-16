import { randomBytes } from "node:crypto";
import { apiRoute, applyConfig } from "@api";
import { z } from "zod";
import { TokenType } from "~database/entities/Token";
import { findFirstUser } from "~database/entities/User";
import { db } from "~drizzle/db";
import { token } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/auth/login",
    auth: {
        required: false,
    },
});

export const schema = z.object({
    email: z.string().email(),
    password: z.string().max(100).min(3),
});

/**
 * OAuth Code flow
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const scopes = (matchedRoute.query.scope || "")
            .replaceAll("+", " ")
            .split(" ");
        const redirect_uri = matchedRoute.query.redirect_uri;
        const response_type = matchedRoute.query.response_type;
        const client_id = matchedRoute.query.client_id;

        const { email, password } = extraData.parsedRequest;

        const redirectToLogin = (error: string) =>
            Response.redirect(
                `/oauth/authorize?${new URLSearchParams({
                    ...matchedRoute.query,
                    error: encodeURIComponent(error),
                }).toString()}`,
                302,
            );

        if (response_type !== "code")
            return redirectToLogin("Invalid response_type");

        if (!email || !password)
            return redirectToLogin("Invalid username or password");

        const user = await findFirstUser({
            where: (user, { eq }) => eq(user.email, email),
        });

        if (
            !user ||
            !(await Bun.password.verify(password, user.password || ""))
        )
            return redirectToLogin("Invalid username or password");

        const application = await db.query.application.findFirst({
            where: (app, { eq }) => eq(app.clientId, client_id),
        });

        if (!application) return redirectToLogin("Invalid client_id");

        const code = randomBytes(32).toString("hex");

        await db.insert(token).values({
            accessToken: randomBytes(64).toString("base64url"),
            code: code,
            scope: scopes.join(" "),
            tokenType: TokenType.BEARER,
            applicationId: application.id,
            userId: user.id,
        });

        // Redirect to OAuth confirmation screen
        return Response.redirect(
            `/oauth/redirect?${new URLSearchParams({
                redirect_uri,
                code,
                client_id,
                application: application.name,
                website: application.website ?? "",
                scope: scopes.join(" "),
            }).toString()}`,
            302,
        );
    },
);
