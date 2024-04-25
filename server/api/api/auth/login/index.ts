import { apiRoute, applyConfig } from "@api";
import { errorResponse, response } from "@response";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { stringify } from "qs";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { db } from "~drizzle/db";
import { Users } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { User } from "~packages/database-interface/user";
import { RequestParser } from "~packages/request-parser";

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
    password: z.string().min(2).max(100),
});

export const querySchema = z.object({
    scope: z.string().optional(),
    redirect_uri: z.string().url().optional(),
    response_type: z.enum([
        "code",
        "token",
        "none",
        "id_token",
        "code id_token",
        "code token",
        "token id_token",
        "code token id_token",
    ]),
    client_id: z.string(),
    state: z.string().optional(),
    code_challenge: z.string().optional(),
    code_challenge_method: z.enum(["plain", "S256"]).optional(),
    prompt: z
        .enum(["none", "login", "consent", "select_account"])
        .optional()
        .default("none"),
    max_age: z
        .number()
        .int()
        .optional()
        .default(60 * 60 * 24 * 7),
});

const returnError = (query: object, error: string, description: string) =>
    response(null, 302, {
        Location: `/oauth/authorize?${stringify({
            ...query,
            error,
            error_description: description,
        })}`,
    });

/**
 * Login flow
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const { email, password } = extraData.parsedRequest;

    if (!email || !password)
        return returnError(
            extraData.parsedRequest,
            "invalid_request",
            "Missing email or password",
        );

    // Find user
    const user = await User.fromSql(eq(Users.email, email));

    if (
        !user ||
        !(await Bun.password.verify(password, user.getUser().password || ""))
    )
        return returnError(
            extraData.parsedRequest,
            "invalid_request",
            "Invalid email or password",
        );

    const parsedQuery = await new RequestParser(
        new Request(req.url),
    ).toObject();

    if (!parsedQuery) {
        return errorResponse("Invalid query", 400);
    }

    const parsingResult = querySchema.safeParse(parsedQuery);

    if (parsingResult && !parsingResult.success) {
        // Return a 422 error with the first error message
        return errorResponse(fromZodError(parsingResult.error).toString(), 422);
    }

    const { client_id } = parsingResult.data;

    // Try and import the key
    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        Buffer.from(config.oidc.jwt_key.split(";")[0], "base64"),
        "Ed25519",
        false,
        ["sign"],
    );

    // Generate JWT
    const jwt = await new SignJWT({
        sub: user.id,
        iss: new URL(config.http.base_url).origin,
        aud: client_id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
    })
        .setProtectedHeader({ alg: "EdDSA" })
        .sign(privateKey);

    const application = await db.query.Applications.findFirst({
        where: (app, { eq }) => eq(app.clientId, client_id),
    });

    if (!application) {
        return errorResponse("Invalid application", 400);
    }

    const searchParams = new URLSearchParams({
        application: application.name,
        client_secret: application.secret,
    });

    if (application.website)
        searchParams.append("website", application.website);

    // Add all data that is not undefined
    for (const [key, value] of Object.entries(parsingResult.data)) {
        if (value !== undefined) searchParams.append(key, String(value));
    }

    // Redirect to OAuth authorize with JWT
    return response(null, 302, {
        Location: new URL(
            `/oauth/consent?${searchParams.toString()}`,
            config.http.base_url,
        ).toString(),
        // Set cookie with JWT
        "Set-Cookie": `jwt=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${
            60 * 60
        }`,
    });
});
