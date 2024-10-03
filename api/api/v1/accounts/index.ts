import { apiRoute, applyConfig, auth } from "@/api";
import { tempmailDomains } from "@/tempmail";
import { createRoute } from "@hono/zod-openapi";
import { and, eq, isNull } from "drizzle-orm";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    route: "/api/v1/accounts",
    ratelimits: {
        max: 2,
        duration: 60,
    },
    auth: {
        required: false,
        oauthPermissions: ["write:accounts"],
    },
    challenge: {
        required: true,
    },
});

export const schemas = {
    json: z.object({
        username: z.string(),
        email: z.string().toLowerCase(),
        password: z.string().optional(),
        agreement: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .or(z.boolean()),
        locale: z.string(),
        reason: z.string(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts",
    summary: "Create account",
    description: "Register a new account",
    middleware: [auth(meta.auth, meta.permissions, meta.challenge)],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
                "multipart/form-data": {
                    schema: schemas.json,
                },
                "application/x-www-form-urlencoded": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Account created",
        },
        422: {
            description: "Validation failed",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string(),
                        details: z.object({
                            username: z.array(
                                z.object({
                                    error: z.enum([
                                        "ERR_BLANK",
                                        "ERR_INVALID",
                                        "ERR_TOO_LONG",
                                        "ERR_TOO_SHORT",
                                        "ERR_BLOCKED",
                                        "ERR_TAKEN",
                                        "ERR_RESERVED",
                                        "ERR_ACCEPTED",
                                        "ERR_INCLUSION",
                                    ]),
                                    description: z.string(),
                                }),
                            ),
                            email: z.array(
                                z.object({
                                    error: z.enum([
                                        "ERR_BLANK",
                                        "ERR_INVALID",
                                        "ERR_BLOCKED",
                                        "ERR_TAKEN",
                                    ]),
                                    description: z.string(),
                                }),
                            ),
                            password: z.array(
                                z.object({
                                    error: z.enum([
                                        "ERR_BLANK",
                                        "ERR_INVALID",
                                        "ERR_TOO_LONG",
                                        "ERR_TOO_SHORT",
                                    ]),
                                    description: z.string(),
                                }),
                            ),
                            agreement: z.array(
                                z.object({
                                    error: z.enum(["ERR_ACCEPTED"]),
                                    description: z.string(),
                                }),
                            ),
                            locale: z.array(
                                z.object({
                                    error: z.enum(["ERR_BLANK", "ERR_INVALID"]),
                                    description: z.string(),
                                }),
                            ),
                            reason: z.array(
                                z.object({
                                    error: z.enum(["ERR_BLANK"]),
                                    description: z.string(),
                                }),
                            ),
                        }),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const form = context.req.valid("json");
        const { username, email, password, agreement, locale } =
            context.req.valid("json");

        if (!config.signups.registration) {
            return context.json(
                {
                    error: "Registration is disabled",
                },
                422,
            );
        }

        const errors: {
            details: Record<
                string,
                {
                    error:
                        | "ERR_BLANK"
                        | "ERR_INVALID"
                        | "ERR_TOO_LONG"
                        | "ERR_TOO_SHORT"
                        | "ERR_BLOCKED"
                        | "ERR_TAKEN"
                        | "ERR_RESERVED"
                        | "ERR_ACCEPTED"
                        | "ERR_INCLUSION";
                    description: string;
                }[]
            >;
        } = {
            details: {
                password: [],
                username: [],
                email: [],
                agreement: [],
                locale: [],
                reason: [],
            },
        };

        // Check if fields are blank
        for (const value of [
            "username",
            "email",
            "password",
            "agreement",
            "locale",
            "reason",
        ]) {
            // @ts-expect-error We don't care about the type here
            if (!form[value]) {
                errors.details[value].push({
                    error: "ERR_BLANK",
                    description: "can't be blank",
                });
            }
        }

        // Check if username is valid
        if (!username?.match(/^[a-z0-9_]+$/)) {
            errors.details.username.push({
                error: "ERR_INVALID",
                description:
                    "must only contain lowercase letters, numbers, and underscores",
            });
        }

        // Check if username doesnt match filters
        if (config.filters.username.some((filter) => username?.match(filter))) {
            errors.details.username.push({
                error: "ERR_INVALID",
                description: "contains blocked words",
            });
        }

        // Check if username is too long
        if ((username?.length ?? 0) > config.validation.max_username_size) {
            errors.details.username.push({
                error: "ERR_TOO_LONG",
                description: `is too long (maximum is ${config.validation.max_username_size} characters)`,
            });
        }

        // Check if username is too short
        if ((username?.length ?? 0) < 3) {
            errors.details.username.push({
                error: "ERR_TOO_SHORT",
                description: "is too short (minimum is 3 characters)",
            });
        }

        // Check if username is reserved
        if (config.validation.username_blacklist.includes(username ?? "")) {
            errors.details.username.push({
                error: "ERR_RESERVED",
                description: "is reserved",
            });
        }

        // Check if username is taken
        if (
            await User.fromSql(
                and(eq(Users.username, username)),
                isNull(Users.instanceId),
            )
        ) {
            errors.details.username.push({
                error: "ERR_TAKEN",
                description: "is already taken",
            });
        }

        // Check if email is valid
        if (
            !email?.match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            )
        ) {
            errors.details.email.push({
                error: "ERR_INVALID",
                description: "must be a valid email address",
            });
        }

        // Check if email is blocked
        if (
            config.validation.email_blacklist.includes(email) ||
            (config.validation.blacklist_tempmail &&
                tempmailDomains.domains.includes((email ?? "").split("@")[1]))
        ) {
            errors.details.email.push({
                error: "ERR_BLOCKED",
                description: "is from a blocked email provider",
            });
        }

        // Check if email is taken
        if (await User.fromSql(eq(Users.email, email))) {
            errors.details.email.push({
                error: "ERR_TAKEN",
                description: "is already taken",
            });
        }

        // Check if agreement is accepted
        if (!agreement) {
            errors.details.agreement.push({
                error: "ERR_ACCEPTED",
                description: "must be accepted",
            });
        }

        if (!locale) {
            errors.details.locale.push({
                error: "ERR_BLANK",
                description: "can't be blank",
            });
        }

        if (!ISO6391.validate(locale ?? "")) {
            errors.details.locale.push({
                error: "ERR_INVALID",
                description: "must be a valid ISO 639-1 code",
            });
        }

        // If any errors are present, return them
        if (Object.values(errors.details).some((value) => value.length > 0)) {
            // Error is something like "Validation failed: Password can't be blank, Username must contain only letters, numbers and underscores, Agreement must be accepted"

            const errorsText = Object.entries(errors.details)
                .filter(([_, errors]) => errors.length > 0)
                .map(
                    ([name, errors]) =>
                        `${name} ${errors
                            .map((error) => error.description)
                            .join(", ")}`,
                )
                .join(", ");
            return context.json(
                {
                    error: `Validation failed: ${errorsText}`,
                    details: Object.fromEntries(
                        Object.entries(errors.details).filter(
                            ([_, errors]) => errors.length > 0,
                        ),
                    ),
                },
                422,
            );
        }

        await User.fromDataLocal({
            username: username ?? "",
            password: password ?? "",
            email: email ?? "",
        });

        return context.newResponse(null, 200);
    }),
);
