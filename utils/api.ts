import type { Context } from "@hono/hono";
import { createMiddleware } from "@hono/hono/factory";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { getLogger } from "@logtape/logtape";
import { extractParams, verifySolution } from "altcha-lib";
import chalk from "chalk";
import { eq } from "drizzle-orm";
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
import { parse } from "qs";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { Application } from "~/classes/database/application";
import type { User } from "~/classes/database/user";
import { type AuthData, getFromHeader } from "~/classes/functions/user";
import { db } from "~/drizzle/db";
import { Challenges } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index.ts";
import type { ApiRouteMetadata, HonoEnv, HttpVerb } from "~/types/api";

export const applyConfig = (routeMeta: ApiRouteMetadata) => {
    const newMeta = routeMeta;

    // Apply ratelimits from config
    newMeta.ratelimits.duration *= config.ratelimits.duration_coeff;
    newMeta.ratelimits.max *= config.ratelimits.max_coeff;

    if (config.ratelimits.custom[routeMeta.route]) {
        newMeta.ratelimits = config.ratelimits.custom[routeMeta.route];
    }

    return newMeta;
};

export const apiRoute = (fn: (app: OpenAPIHono<HonoEnv>) => void) => fn;

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
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-"))).groupedAs(
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
    oneOrMore(anyOf(letter.lowercase, digit, charIn("-"))).groupedAs(
        "username",
    ),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [global],
);

export const webfingerMention = createRegExp(
    exactly("acct:"),
    oneOrMore(anyOf(letter, digit, charIn("-"))).groupedAs("username"),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [],
);

export const parseUserAddress = (address: string) => {
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
    permissionData: ApiRouteMetadata["permissions"],
    context: Context,
): Response | undefined => {
    const userPerms = auth?.user
        ? auth.user.getAllPermissions()
        : config.permissions.anonymous;
    const requiredPerms =
        permissionData?.methodOverrides?.[context.req.method as HttpVerb] ??
        permissionData?.required ??
        [];

    if (!requiredPerms.every((perm) => userPerms.includes(perm))) {
        const missingPerms = requiredPerms.filter(
            (perm) => !userPerms.includes(perm),
        );
        return context.json(
            {
                error: `You do not have the required permissions to access this route. Missing: ${missingPerms.join(", ")}`,
            },
            403,
        );
    }
};

const checkRouteNeedsAuth = (
    auth: AuthData | null,
    authData: ApiRouteMetadata["auth"],
    context: Context,
):
    | Response
    | {
          user: User | null;
          token: string | null;
          application: Application | null;
      } => {
    if (auth?.user) {
        return {
            user: auth.user as User,
            token: auth.token as string,
            application: auth.application
                ? new Application(auth.application)
                : null,
        };
    }
    if (
        authData.required ||
        authData.methodOverrides?.[context.req.method as HttpVerb]
    ) {
        return context.json(
            {
                error: "This route requires authentication.",
            },
            401,
        );
    }

    return {
        user: null,
        token: null,
        application: null,
    };
};

export const checkRouteNeedsChallenge = async (
    challengeData: ApiRouteMetadata["challenge"],
    context: Context,
): Promise<true | Response> => {
    if (!challengeData) {
        return true;
    }

    const challengeSolution = context.req.header("X-Challenge-Solution");

    if (!challengeSolution) {
        return context.json(
            {
                error: "This route requires a challenge solution to be sent to it via the X-Challenge-Solution header. Please check the documentation for more information.",
            },
            401,
        );
    }

    const { challenge_id } = extractParams(challengeSolution);

    if (!challenge_id) {
        return context.json(
            {
                error: "The challenge solution provided is invalid.",
            },
            401,
        );
    }

    const challenge = await db.query.Challenges.findFirst({
        where: (c, { eq }) => eq(c.id, challenge_id),
    });

    if (!challenge) {
        return context.json(
            {
                error: "The challenge solution provided is invalid.",
            },
            401,
        );
    }

    if (new Date(challenge.expiresAt) < new Date()) {
        return context.json(
            {
                error: "The challenge provided has expired.",
            },
            401,
        );
    }

    const isValid = await verifySolution(
        challengeSolution,
        config.validation.challenges.key,
    );

    if (!isValid) {
        return context.json(
            {
                error: "The challenge solution provided is incorrect.",
            },
            401,
        );
    }

    // Expire the challenge
    await db
        .update(Challenges)
        .set({ expiresAt: new Date().toISOString() })
        .where(eq(Challenges.id, challenge_id));

    return true;
};

export const auth = (
    authData: ApiRouteMetadata["auth"],
    permissionData?: ApiRouteMetadata["permissions"],
    challengeData?: ApiRouteMetadata["challenge"],
) =>
    createMiddleware<HonoEnv>(async (context, next) => {
        const header = context.req.header("Authorization");

        const auth = header ? await getFromHeader(header) : null;

        // Only exists for type casting, as otherwise weird errors happen with Hono
        const fakeResponse = context.json({});

        // Permissions check
        if (permissionData) {
            const permissionCheck = checkPermissions(
                auth,
                permissionData,
                context,
            );
            if (permissionCheck) {
                return permissionCheck as typeof fakeResponse;
            }
        }

        if (challengeData && config.validation.challenges.enabled) {
            const challengeCheck = await checkRouteNeedsChallenge(
                challengeData,
                context,
            );
            if (challengeCheck !== true) {
                return challengeCheck as typeof fakeResponse;
            }
        }

        const authCheck = checkRouteNeedsAuth(auth, authData, context) as
            | typeof fakeResponse
            | {
                  user: User | null;
                  token: string | null;
                  application: Application | null;
              };

        if (authCheck instanceof Response) {
            return authCheck;
        }

        context.set("auth", authCheck);

        await next();
    });

// Helper function to parse form data
async function parseFormData(context: Context) {
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
async function parseUrlEncoded(context: Context) {
    const parsed = parse(await context.req.text(), {
        parseArrays: true,
        interpretNumericEntities: true,
    });

    return parsed;
}

export const qsQuery = () => {
    return createMiddleware(async (context, next) => {
        const parsed = parse(context.req.query(), {
            parseArrays: true,
            interpretNumericEntities: true,
        });

        // @ts-expect-error Very bad hack
        context.req.query = () => parsed;

        // @ts-expect-error I'm so sorry for this
        context.req.queries = () => parsed;
        await next();
    });
};

export const setContextFormDataToObject = (
    context: Context,
    setTo: object,
): Context => {
    context.req.bodyCache.json = setTo;
    context.req.parseBody = () => Promise.resolve(context.req.bodyCache.json);
    context.req.json = () => Promise.resolve(context.req.bodyCache.json);

    return context;
};

/*
 * Middleware to magically unfuck forms
 * Add it to random Hono routes and hope it works
 * @returns
 */
export const jsonOrForm = () => {
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

export const debugRequest = async (req: Request) => {
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

export const debugResponse = async (res: Response) => {
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
