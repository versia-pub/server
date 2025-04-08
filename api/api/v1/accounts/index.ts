import { apiRoute, auth, handleZodError, jsonOrForm } from "@/api";
import { tempmailDomains } from "@/tempmail";
import { zBoolean } from "@versia/client/schemas";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";
import { rateLimit } from "~/middlewares/rate-limit";

const schema = z.object({
    username: z.string().openapi({
        description: "The desired username for the account",
        example: "alice",
    }),
    email: z.string().toLowerCase().openapi({
        description:
            "The email address to be used for login. Transformed to lowercase.",
        example: "alice@gmail.com",
    }),
    password: z.string().openapi({
        description: "The password to be used for login",
        example: "hunter2",
    }),
    agreement: zBoolean.openapi({
        description:
            "Whether the user agrees to the local rules, terms, and policies. These should be presented to the user in order to allow them to consent before setting this parameter to TRUE.",
        example: true,
    }),
    locale: z.string().openapi({
        description:
            "The language of the confirmation email that will be sent. ISO 639-1 code.",
        example: "en",
    }),
    reason: z.string().optional().openapi({
        description:
            "If registrations require manual approval, this text will be reviewed by moderators.",
    }),
});

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts",
        describeRoute({
            summary: "Register an account",
            description:
                "Creates a user and account records. Returns an account access token for the app that initiated the request. The app should save this token for later, and should wait for the user to confirm their account by clicking a link in their email inbox.\n\nA relationship between the OAuth Application and created user account is stored.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#create",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Token for the created account",
                },
                401: ApiError.missingAuthentication().schema,
                422: {
                    description: "Validation failed",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.object({
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
                                                error: z.enum([
                                                    "ERR_BLANK",
                                                    "ERR_INVALID",
                                                ]),
                                                description: z.string(),
                                            }),
                                        ),
                                        reason: z.array(
                                            z.object({
                                                error: z.enum([
                                                    "ERR_BLANK",
                                                    "ERR_TOO_LONG",
                                                ]),
                                                description: z.string(),
                                            }),
                                        ),
                                    }),
                                }),
                            ),
                        },
                    },
                },
            },
        }),
        auth({
            auth: false,
            scopes: ["write:accounts"],
            challenge: true,
        }),
        rateLimit(5),
        jsonOrForm(),
        validator("json", schema, handleZodError),
        async (context) => {
            const form = context.req.valid("json");
            const { username, email, password, agreement, locale } =
                context.req.valid("json");

            if (!config.registration.allow) {
                throw new ApiError(422, "Registration is disabled");
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
            if (
                config.validation.filters.username.some((filter) =>
                    filter.test(username),
                )
            ) {
                errors.details.username.push({
                    error: "ERR_INVALID",
                    description: "contains blocked words",
                });
            }

            // Check if username is too long
            if (
                (username?.length ?? 0) >
                config.validation.accounts.max_username_characters
            ) {
                errors.details.username.push({
                    error: "ERR_TOO_LONG",
                    description: `is too long (maximum is ${config.validation.accounts.max_username_characters} characters)`,
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
            if (
                config.validation.accounts.disallowed_usernames.some((filter) =>
                    filter.test(username),
                )
            ) {
                errors.details.username.push({
                    error: "ERR_RESERVED",
                    description: "is reserved",
                });
            }

            // Check if username is taken
            if (
                await User.fromSql(
                    and(eq(Users.username, username), isNull(Users.instanceId)),
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
                config.validation.emails.disallowed_domains.some((f) =>
                    f.test(email.split("@")[1]),
                ) ||
                (config.validation.emails.disallow_tempmail &&
                    tempmailDomains.domains.includes(email.split("@")[1]))
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

            // Check if reason is too long
            if ((form.reason?.length ?? 0) > 10_000) {
                errors.details.reason.push({
                    error: "ERR_TOO_LONG",
                    description: `is too long (maximum is ${10_000} characters)`,
                });
            }

            // If any errors are present, return them
            if (
                Object.values(errors.details).some((value) => value.length > 0)
            ) {
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
                throw new ApiError(
                    422,
                    `Validation failed: ${errorsText}`,
                    Object.fromEntries(
                        Object.entries(errors.details).filter(
                            ([_, errors]) => errors.length > 0,
                        ),
                    ),
                );
            }

            await User.register(username, {
                password,
                email,
            });

            return context.text("", 200);
        },
    ),
);
