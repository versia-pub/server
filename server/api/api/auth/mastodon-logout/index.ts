import { randomBytes } from "node:crypto";
import { apiRoute, applyConfig } from "@api";
import { z } from "zod";
import { TokenType } from "~database/entities/Token";
import { findFirstUser } from "~database/entities/User";
import { db } from "~drizzle/db";
import { token } from "~drizzle/schema";
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

/**
 * Mastodon-FE logout route
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    // Redirect to home
    return new Response(null, {
        headers: {
            Location: "/",
            "Set-Cookie": `_session_id=; Domain=${
                new URL(config.http.base_url).hostname
            }; SameSite=Lax; Path=/; HttpOnly; Max-Age=0; Expires=${new Date().toUTCString()}`,
        },
        status: 303,
    });
});
