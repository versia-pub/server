import { errorResponse } from "@/response";
import chalk from "chalk";
import { config } from "config-manager";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import {
    anyOf,
    caseInsensitive,
    charIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    maybe,
    oneOrMore,
} from "magic-regexp";
import { parse } from "qs";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import type { Application } from "~/database/entities/application";
import { type AuthData, getFromHeader } from "~/database/entities/user";
import type { User } from "~/packages/database-interface/user";
import { LogLevel, LogManager } from "~/packages/log-manager";
import type { ApiRouteMetadata, HttpVerb } from "~/types/api";

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
    oneOrMore(letter.or(digit).or(exactly("_")).or(exactly("-"))),
    [caseInsensitive, global],
);

export const emojiValidatorWithColons = createRegExp(
    exactly(":"),
    oneOrMore(letter.or(digit).or(exactly("_")).or(exactly("-"))),
    exactly(":"),
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

export const webfingerMention = createRegExp(
    exactly("acct:"),
    oneOrMore(anyOf(letter, digit, charIn("-"))).groupedAs("username"),
    maybe(
        exactly("@"),
        oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs("domain"),
    ),
    [],
);

export const handleZodError = (
    result:
        | { success: true; data?: object }
        | { success: false; error: z.ZodError<z.AnyZodObject>; data?: object },
    _context: Context,
) => {
    if (!result.success) {
        return errorResponse(fromZodError(result.error).message, 422);
    }
};

const getAuth = async (value: Record<string, string>) => {
    return value.authorization
        ? await getFromHeader(value.authorization)
        : null;
};

const checkPermissions = (
    auth: AuthData | null,
    permissionData: ApiRouteMetadata["permissions"],
    context: Context,
) => {
    const userPerms = auth?.user
        ? auth.user.getAllPermissions()
        : config.permissions.anonymous;
    const requiredPerms =
        permissionData?.methodOverrides?.[context.req.method as HttpVerb] ??
        permissionData?.required ??
        [];
    const error = errorResponse("Unauthorized", 401);

    if (!requiredPerms.every((perm) => userPerms.includes(perm))) {
        const missingPerms = requiredPerms.filter(
            (perm) => !userPerms.includes(perm),
        );
        return context.json(
            {
                error: `You do not have the required permissions to access this route. Missing: ${missingPerms.join(", ")}`,
            },
            403,
            error.headers.toJSON(),
        );
    }
};

const checkRouteNeedsAuth = (
    auth: AuthData | null,
    authData: ApiRouteMetadata["auth"],
    context: Context,
) => {
    const error = errorResponse("Unauthorized", 401);

    if (auth?.user) {
        return {
            user: auth.user as User,
            token: auth.token as string,
            application: auth.application as Application | null,
        };
    }
    if (authData.required) {
        return context.json(
            {
                error: "Unauthorized",
            },
            401,
            error.headers.toJSON(),
        );
    }

    if (authData.requiredOnMethods?.includes(context.req.method as HttpVerb)) {
        return context.json(
            {
                error: "Unauthorized",
            },
            401,
            error.headers.toJSON(),
        );
    }

    return {
        user: null,
        token: null,
        application: null,
    };
};

export const auth = (
    authData: ApiRouteMetadata["auth"],
    permissionData?: ApiRouteMetadata["permissions"],
) =>
    validator("header", async (value, context) => {
        const auth = await getAuth(value);

        // Permissions check
        if (permissionData) {
            const permissionCheck = checkPermissions(
                auth,
                permissionData,
                context,
            );
            if (permissionCheck) {
                return permissionCheck;
            }
        }

        return checkRouteNeedsAuth(auth, authData, context);
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

        // @ts-ignore Very bad hack
        context.req.query = () => parsed;

        // @ts-ignore I'm so sorry for this
        context.req.queries = () => parsed;
        await next();
    });
};

export const setContextFormDataToObject = (
    context: Context,
    setTo: object,
): Context => {
    // @ts-expect-error HACK
    context.req.bodyCache.formData = setTo;
    context.req.parseBody = async () =>
        context.req.bodyCache.formData as FormData;
    context.req.formData = async () =>
        context.req.bodyCache.formData as FormData;

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
        } else if (contentType?.includes("multipart/form-data")) {
            const { parsed, files } = await parseFormData(context);

            setContextFormDataToObject(context, {
                ...parsed,
                ...Object.fromEntries(files),
            });
        }

        await next();
    });
};

export const debugRequest = async (
    req: Request,
    logger = new LogManager(Bun.stdout),
) => {
    const body = await req.clone().text();
    await logger.log(
        LogLevel.Debug,
        "RequestDebugger",
        `\n${chalk.green(req.method)} ${chalk.blue(req.url)}\n${chalk.bold(
            "Hash",
        )}: ${chalk.yellow(
            new Bun.SHA256().update(body).digest("hex"),
        )}\n${chalk.bold("Headers")}:\n${Array.from(req.headers.entries())
            .map(
                ([key, value]) =>
                    ` - ${chalk.cyan(key)}: ${chalk.white(value)}`,
            )
            .join("\n")}\n${chalk.bold("Body")}: ${chalk.gray(body)}`,
    );
};
