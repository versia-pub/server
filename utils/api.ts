import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { getLogger } from "@logtape/logtape";
import { Application, Note, Token, User, db } from "@versia/kit/db";
import { Challenges, type RolePermissions } from "@versia/kit/tables";
import { extractParams, verifySolution } from "altcha-lib";
import chalk from "chalk";
import { type SQL, eq } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import {
    anyOf,
    caseInsensitive,
    charIn,
    charNotIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    maybe,
    not,
    oneOrMore,
} from "magic-regexp";
import { type ParsedQs, parse } from "qs";
import { fromZodError } from "zod-validation-error";
import { ApiError } from "~/classes/errors/api-error";
import type { AuthData } from "~/classes/functions/user";
import { config } from "~/packages/config-manager/index.ts";
import type { HonoEnv } from "~/types/api";

export const apiRoute = (fn: (app: OpenAPIHono<HonoEnv>) => void): typeof fn =>
    fn;

export const idValidator = createRegExp(
    anyOf(digit, charIn("ABCDEF")).times(8),
    exactly("-"),
    anyOf(digit, charIn("ABCDEF")).times(4),
    exactly("-"),
    exactly("7"),
    anyOf(digit, charIn("ABCDEF")).times(3),
    exactly("-"),
    anyOf("8", "9", "A", "B").times(1),
    anyOf(digit, charIn("ABCDEF")).times(3),
    exactly("-"),
    anyOf(digit, charIn("ABCDEF")).times(12),
    [caseInsensitive],
);

export const emojiValidator = createRegExp(
    // A-Z a-z 0-9 _ -
    oneOrMore(letter.or(digit).or(charIn("_-"))),
    [caseInsensitive, global],
);

export const emojiValidatorWithColons = createRegExp(
    exactly(":"),
    oneOrMore(letter.or(digit).or(charIn("_-"))),
    exactly(":"),
    [caseInsensitive, global],
);

export const emojiValidatorWithIdentifiers = createRegExp(
    exactly(
        exactly(not.letter.or(not.digit).or(charNotIn("_-"))).times(1),
        oneOrMore(letter.or(digit).or(charIn("_-"))).groupedAs("shortcode"),
        exactly(not.letter.or(not.digit).or(charNotIn("_-"))).times(1),
    ),
    [caseInsensitive, global],
);

export const mentionValidator = createRegExp(
    exactly("@"),
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-_"))).groupedAs(
        "username",
    ),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [global],
);

export const userAddressValidator = createRegExp(
    maybe("@"),
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-_"))).groupedAs(
        "username",
    ),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [global],
);

export const userAddressValidatorRemote = createRegExp(
    maybe("@"),
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-_"))).groupedAs(
        "username",
    ),
    exactly("@"),
    oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    [global],
);

export const webfingerMention = createRegExp(
    exactly("acct:"),
    oneOrMore(anyOf(letter, digit, charIn("-_"))).groupedAs("username"),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [],
);

export const parseUserAddress = (
    address: string,
): {
    username: string;
    domain?: string;
} => {
    let output = address;
    // Remove leading @ if it exists
    if (output.startsWith("@")) {
        output = output.slice(1);
    }

    const [username, domain] = output.split("@");
    return { username, domain };
};

export const handleZodError = (
    result:
        | { success: true; data?: object }
        | { success: false; error: z.ZodError<z.AnyZodObject>; data?: object },
    context: Context,
): Response | undefined => {
    if (!result.success) {
        return context.json(
            {
                error: fromZodError(result.error).message,
            },
            422,
        );
    }
};

const checkPermissions = (
    auth: AuthData | null,
    required: RolePermissions[],
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
    if (!required) {
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
        where: (c, { eq }): SQL | undefined => eq(c.id, challenge_id),
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

type HonoEnvWithAuth = HonoEnv & {
    Variables: {
        auth: AuthData & {
            user: NonNullable<AuthData["user"]>;
            token: NonNullable<AuthData["token"]>;
        };
    };
};

export const auth = <AuthRequired extends boolean>(options: {
    auth: AuthRequired;
    permissions?: RolePermissions[];
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
            application: token?.data.application
                ? new Application(token?.data.application)
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
        if (options.challenge && config.validation.challenges.enabled) {
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
    zValidator("param", z.object({ id: z.string().uuid() }), handleZodError),
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
            throw new ApiError(404, "Note not found");
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
    zValidator("param", z.object({ id: z.string().uuid() }), handleZodError),
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

// Helper function to parse form data
async function parseFormData(context: Context): Promise<{
    parsed: ParsedQs;
    files: Map<string, File>;
}> {
    const formData = await context.req.formData();
    const urlparams = new URLSearchParams();
    const files = new Map<string, File>();
    for (const [key, value] of [...formData.entries()]) {
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
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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

export const debugRequest = async (req: Request): Promise<void> => {
    const body = await req.text();
    const logger = getLogger("server");

    const urlAndMethod = `${chalk.green(req.method)} ${chalk.blue(req.url)}`;

    const hash = `${chalk.bold("Hash")}: ${chalk.yellow(
        new Bun.SHA256().update(body).digest("hex"),
    )}`;

    const headers = `${chalk.bold("Headers")}:\n${Array.from(
        req.headers.entries(),
    )
        .map(([key, value]) => ` - ${chalk.cyan(key)}: ${chalk.white(value)}`)
        .join("\n")}`;

    const bodyLog = `${chalk.bold("Body")}: ${chalk.gray(body)}`;

    if (config.logging.log_requests_verbose) {
        logger.debug`${urlAndMethod}\n${hash}\n${headers}\n${bodyLog}`;
    } else {
        logger.debug`${urlAndMethod}`;
    }
};

export const debugResponse = async (res: Response): Promise<void> => {
    const body = await res.clone().text();
    const logger = getLogger("server");

    const status = `${chalk.bold("Status")}: ${chalk.green(res.status)}`;

    const headers = `${chalk.bold("Headers")}:\n${Array.from(
        res.headers.entries(),
    )
        .map(([key, value]) => ` - ${chalk.cyan(key)}: ${chalk.white(value)}`)
        .join("\n")}`;

    const bodyLog = `${chalk.bold("Body")}: ${chalk.gray(body)}`;

    if (config.logging.log_requests_verbose) {
        logger.debug`${status}\n${headers}\n${bodyLog}`;
    } else {
        logger.debug`${status}`;
    }
};
