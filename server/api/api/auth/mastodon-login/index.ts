import { randomBytes } from "node:crypto";
import { apiRoute, applyConfig } from "@api";
import { z } from "zod";
import { TokenType } from "~database/entities/Token";
import { findFirstUser } from "~database/entities/User";
import { db } from "~drizzle/db";
import { Tokens } from "~drizzle/schema";
import { config } from "~packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/auth/mastodon-logout",
    auth: {
        required: false,
    },
});

export const schema = z.object({
    "user[email]": z.string().email(),
    "user[password]": z.string().max(100).min(3),
});

/**
 * Mastodon-FE login route
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { "user[email]": email, "user[password]": password } =
            extraData.parsedRequest;

        const redirectToLogin = (error: string) =>
            Response.redirect(
                `/auth/sign_in?${new URLSearchParams({
                    ...matchedRoute.query,
                    error: encodeURIComponent(error),
                }).toString()}`,
                302,
            );

        const user = await findFirstUser({
            where: (user, { eq }) => eq(user.email, email),
        });

        if (
            !user ||
            !(await Bun.password.verify(password, user.password || ""))
        )
            return redirectToLogin("Invalid email or password");

        const code = randomBytes(32).toString("hex");
        const accessToken = randomBytes(64).toString("base64url");

        await db.insert(Tokens).values({
            accessToken,
            code: code,
            scope: "read write follow push",
            tokenType: TokenType.BEARER,
            applicationId: null,
            userId: user.id,
        });

        // One week from now
        const maxAge = String(60 * 60 * 24 * 7);

        // Redirect to home
        return new Response(null, {
            headers: {
                Location: "/",
                "Set-Cookie": `_session_id=${accessToken}; Domain=${
                    new URL(config.http.base_url).hostname
                }; SameSite=Lax; Path=/; HttpOnly; Max-Age=${maxAge}`,
            },
            status: 303,
        });
    },
);
