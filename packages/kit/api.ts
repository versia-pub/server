import type { Hook } from "@hono/standard-validator";
import type { RolePermission } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { serverLogger } from "@versia-server/logging";
import { extractParams, verifySolution } from "altcha-lib";
import chalk from "chalk";
import { eq, type SQL } from "drizzle-orm";
import type { Context, Hono, MiddlewareHandler, ValidationTargets } from "hono";
import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { validator } from "hono-openapi";
import { type ParsedQs, parse } from "qs";
import { type ZodAny, ZodError, z } from "zod/v4";
import { fromZodError } from "zod-validation-error";
import type { AuthData, HonoEnv } from "~/types/api";
import { ApiError } from "./api-error.ts";
import { Application } from "./db/application.ts";
import { Emoji } from "./db/emoji.ts";
import { Note } from "./db/note.ts";
import { Token } from "./db/token.ts";
import { User } from "./db/user.ts";
import { db } from "./tables/db.ts";
import { Challenges } from "./tables/schema.ts";

export const apiRoute = (fn: (app: Hono<HonoEnv>) => void): typeof fn => fn;

export const handleZodError: Hook<
    z.infer<ZodAny>,
    HonoEnv,
    string,
    keyof ValidationTargets
> = (result, context): Response | undefined => {
    if (!result.success) {
        const issues = result.error as z.core.$ZodIssue[];

        return context.json(
            {
                error: fromZodError(new ZodError(issues)).message,
            },
            422,
        );
    }

    return undefined;
};

const checkPermissions = (
    auth: AuthData | null,
    required: RolePermission[],
): void => {
    const userPerms = auth?.user
        ? auth.user.getAllPermissions()
        : config.permissions.anonymous;

    if (!required.every((perm) => userPerms.includes(perm))) {
        const missingPerms = required.filter(
            (perm) => !userPerms.includes(perm),
        );
        throw new ApiError(
            403,
            "Missing permissions",
            `Missing: ${missingPerms.join(", ")}`,
        );
    }
};

const checkRouteNeedsAuth = (
    auth: AuthData | null,
    required: boolean,
): AuthData => {
    if (auth?.user && auth?.token) {
        return {
            user: auth.user,
            token: auth.token,
            application: auth.application,
        };
    }
    if (required) {
        throw new ApiError(401, "This route requires authentication");
    }

    return {
        user: null,
        token: null,
        application: null,
    };
};

export const checkRouteNeedsChallenge = async (
    required: boolean,
    context: Context,
): Promise<void> => {
    if (!(required && config.validation.challenges)) {
        return;
    }

    const challengeSolution = context.req.header("X-Challenge-Solution");

    if (!challengeSolution) {
        throw new ApiError(
            401,
            "Challenge required",
            "This route requires a challenge solution to be sent to it via the X-Challenge-Solution header. Please check the documentation for more information.",
        );
    }

    const { challenge_id } = extractParams(challengeSolution);

    if (!challenge_id) {
        throw new ApiError(401, "The challenge solution provided is invalid.");
    }

    const challenge = await db.query.Challenges.findFirst({
        where: (c): SQL | undefined => eq(c.id, challenge_id),
    });

    if (!challenge) {
        throw new ApiError(401, "The challenge solution provided is invalid.");
    }

    if (new Date(challenge.expiresAt) < new Date()) {
        throw new ApiError(401, "The challenge provided has expired.");
    }

    const isValid = await verifySolution(
        challengeSolution,
        config.validation.challenges.key,
    );

    if (!isValid) {
        throw new ApiError(
            401,
            "The challenge solution provided is incorrect.",
        );
    }

    // Expire the challenge
    await db
        .update(Challenges)
        .set({ expiresAt: new Date().toISOString() })
        .where(eq(Challenges.id, challenge_id));
};

export type HonoEnvWithAuth = HonoEnv & {
    Variables: {
        auth: AuthData & {
            user: NonNullable<AuthData["user"]>;
            token: NonNullable<AuthData["token"]>;
        };
    };
};

export const auth = <AuthRequired extends boolean>(options: {
    auth: AuthRequired;
    permissions?: RolePermission[];
    challenge?: boolean;
    scopes?: string[];
    // If authRequired is true, HonoEnv.Variables.auth.user will never be null
}): MiddlewareHandler<
    AuthRequired extends true ? HonoEnvWithAuth : HonoEnv
> => {
    return createMiddleware(async (context, next) => {
        const header = context.req.header("Authorization");
        const tokenString = header?.split(" ")[1];

        const token = tokenString
            ? await Token.fromAccessToken(tokenString)
            : null;

        const auth: AuthData = {
            token,
            application: token?.data.client
                ? new Application(token?.data.client)
                : null,
            user: (await token?.getUser()) ?? null,
        };

        // Authentication check
        const authCheck = checkRouteNeedsAuth(auth, options.auth);

        context.set("auth", authCheck);

        // Permissions check
        if (options.permissions) {
            checkPermissions(auth, options.permissions);
        }

        // Challenge check
        if (options.challenge && config.validation.challenges) {
            await checkRouteNeedsChallenge(options.challenge, context);
        }

        await next();
    });
};

type WithIdParam = {
    in: { param: { id: string } };
    out: { param: { id: string } };
};

/**
 * Middleware to check if a note exists and is viewable by the user.
 *
 * Useful in /api/v1/statuses/:id/* routes
 * @returns MiddlewareHandler
 */
export const withNoteParam = every(
    validator("param", z.object({ id: z.uuid() }), handleZodError),
    createMiddleware<
        HonoEnv & {
            Variables: {
                note: Note;
            };
        },
        string,
        WithIdParam
    >(async (context, next) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        const note = await Note.fromId(id, user?.id);

        if (!(note && (await note.isViewableByUser(user)))) {
            throw ApiError.noteNotFound();
        }

        context.set("note", note);

        await next();
    }),
) as MiddlewareHandler<
    HonoEnv & {
        Variables: {
            note: Note;
        };
    }
>;

/**
 * Middleware to check if a user exists
 *
 * Useful in /api/v1/accounts/:id/* routes
 * @returns MiddlewareHandler
 */
export const withUserParam = every(
    validator("param", z.object({ id: z.uuid() }), handleZodError),
    createMiddleware<
        HonoEnv & {
            Variables: {
                user: User;
            };
        },
        string,
        WithIdParam
    >(async (context, next) => {
        const { id } = context.req.valid("param");
        const user = await User.fromId(id);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        context.set("user", user);

        await next();
    }),
) as MiddlewareHandler<
    HonoEnv & {
        Variables: {
            user: User;
        };
    }
>;

/**
 * Middleware to check if an emoji exists and is viewable by the user
 *
 * Useful in /api/v1/emojis/:id/* routes
 * @returns
 */
export const withEmojiParam = every(
    validator("param", z.object({ id: z.uuid() }), handleZodError),
    createMiddleware<
        HonoEnv & {
            Variables: {
                emoji: Emoji;
            };
        },
        string,
        WithIdParam
    >(async (context, next) => {
        const { id } = context.req.valid("param");

        const emoji = await Emoji.fromId(id);

        if (!emoji) {
            throw ApiError.emojiNotFound();
        }

        context.set("emoji", emoji);

        await next();
    }),
) as MiddlewareHandler<
    HonoEnv & {
        Variables: {
            emoji: Emoji;
        };
    }
>;

// Helper function to parse form data
async function parseFormData(context: Context): Promise<{
    parsed: ParsedQs;
    files: Map<string, File>;
}> {
    const formData = await context.req.formData();
    const urlparams = new URLSearchParams();
    const files = new Map<string, File>();
    for (const [key, value] of [
        ...(formData.entries() as IterableIterator<[string, string | File]>),
    ]) {
        if (Array.isArray(value)) {
            for (const val of value) {
                urlparams.append(key, val);
            }
        } else if (value instanceof File) {
            if (!files.has(key)) {
                files.set(key, value);
            }
        } else {
            urlparams.append(key, String(value));
        }
    }

    const parsed = parse(urlparams.toString(), {
        parseArrays: true,
        interpretNumericEntities: true,
    });

    return {
        parsed,
        files,
    };
}

// Helper function to parse urlencoded data
async function parseUrlEncoded(context: Context): Promise<ParsedQs> {
    const parsed = parse(await context.req.text(), {
        parseArrays: true,
        interpretNumericEntities: true,
    });

    return parsed;
}

export const qsQuery = (): MiddlewareHandler<HonoEnv> => {
    return createMiddleware<HonoEnv>(async (context, next) => {
        const parsed = parse(new URL(context.req.url).searchParams.toString(), {
            parseArrays: true,
            interpretNumericEntities: true,
        });

        // @ts-expect-error Very bad hack
        context.req.query = (): typeof parsed => parsed;

        // @ts-expect-error I'm so sorry for this
        context.req.queries = (): typeof parsed => parsed;
        await next();
    });
};

export const setContextFormDataToObject = (
    context: Context,
    setTo: object,
): Context => {
    context.req.bodyCache.json = setTo;
    context.req.parseBody = (): Promise<unknown> =>
        Promise.resolve(context.req.bodyCache.json);
    // biome-ignore lint/suspicious/noExplicitAny: Monkeypatching
    context.req.json = (): Promise<any> =>
        Promise.resolve(context.req.bodyCache.json);

    return context;
};

/*
 * Middleware to magically unfuck forms
 * Add it to random Hono routes and hope it works
 * @returns
 */
export const jsonOrForm = (): MiddlewareHandler<HonoEnv> => {
    return createMiddleware(async (context, next) => {
        const contentType = context.req.header("content-type");

        if (contentType?.includes("application/json")) {
            setContextFormDataToObject(context, await context.req.json());
        } else if (contentType?.includes("application/x-www-form-urlencoded")) {
            const parsed = await parseUrlEncoded(context);

            setContextFormDataToObject(context, parsed);
            context.req.raw.headers.set("Content-Type", "application/json");
        } else if (contentType?.includes("multipart/form-data")) {
            const { parsed, files } = await parseFormData(context);

            setContextFormDataToObject(context, {
                ...parsed,
                ...Object.fromEntries(files),
            });
            context.req.raw.headers.set("Content-Type", "application/json");
        } else if (!contentType) {
            setContextFormDataToObject(context, {});
            context.req.raw.headers.set("Content-Type", "application/json");
        }

        await next();
    });
};

export const debugResponse = async (res: Response): Promise<void> => {
    const body = await res.clone().text();

    const status = `${chalk.bold("Status")}: ${chalk.green(res.status)}`;

    const headers = `${chalk.bold("Headers")}:\n${Array.from(
        res.headers.entries(),
    )
        .map(([key, value]) => ` - ${chalk.cyan(key)}: ${chalk.white(value)}`)
        .join("\n")}`;

    const bodyLog = `${chalk.bold("Body")}: ${chalk.gray(body)}`;

    serverLogger.debug`${status}\n${headers}\n${bodyLog}`;
};
