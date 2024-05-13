import { errorResponse } from "@response";
import { config } from "config-manager";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { BodyData } from "hono/utils/body";
import { validator } from "hono/validator";
import {
    anyOf,
    caseInsensitive,
    charIn,
    createRegExp,
    digit,
    exactly,
    letter,
    oneOrMore,
} from "magic-regexp";
import { parse } from "qs";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import type { Application } from "~database/entities/Application";
import { getFromHeader } from "~database/entities/User";
import type { User } from "~packages/database-interface/user";
import type { APIRouteMetadata, HttpVerb } from "~types/api";

export const applyConfig = (routeMeta: APIRouteMetadata) => {
    const newMeta = routeMeta;

    // Apply ratelimits from config
    newMeta.ratelimits.duration *= config.ratelimits.duration_coeff;
    newMeta.ratelimits.max *= config.ratelimits.max_coeff;

    if (config.custom_ratelimits[routeMeta.route]) {
        newMeta.ratelimits = config.custom_ratelimits[routeMeta.route];
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
    [caseInsensitive],
);

export const emojiValidatorWithColons = createRegExp(
    exactly(":"),
    oneOrMore(letter.or(digit).or(exactly("_")).or(exactly("-"))),
    exactly(":"),
    [caseInsensitive],
);

export const handleZodError = (
    result:
        | { success: true; data?: object }
        | { success: false; error: z.ZodError<z.AnyZodObject>; data?: object },
    context: Context,
) => {
    if (!result.success) {
        return errorResponse(fromZodError(result.error).message, 422);
    }
};

export const auth = (authData: APIRouteMetadata["auth"]) =>
    validator("header", async (value, context) => {
        const auth = value.authorization
            ? await getFromHeader(value.authorization)
            : null;

        const error = errorResponse("Unauthorized", 401);

        if (!auth?.user) {
            if (authData.required) {
                return context.json(
                    {
                        error: "Unauthorized",
                    },
                    401,
                    error.headers.toJSON(),
                );
            }

            if (
                authData.requiredOnMethods?.includes(
                    context.req.method as HttpVerb,
                )
            ) {
                return context.json(
                    {
                        error: "Unauthorized",
                    },
                    401,
                    error.headers.toJSON(),
                );
            }
        } else {
            return {
                user: auth.user as User,
                token: auth.token as string,
                application: auth.application as Application | null,
            };
        }

        return {
            user: null,
            token: null,
            application: null,
        };
    });

/**
 * Middleware to magically unfuck forms
 * Add it to random Hono routes and hope it works
 * @returns
 */
export const qs = () => {
    return createMiddleware(async (context, next) => {
        const contentType = context.req.header("content-type");

        if (contentType?.includes("multipart/form-data")) {
            // Get it as a query format to pass on to qs, then insert back files
            const formData = await context.req.formData();
            const urlparams = new URLSearchParams();
            const files = new Map<string, File>();
            for (const [key, value] of [...formData.entries()]) {
                if (Array.isArray(value)) {
                    for (const val of value) {
                        urlparams.append(key, val);
                    }
                } else if (!(value instanceof File)) {
                    urlparams.append(key, String(value));
                } else {
                    if (!files.has(key)) {
                        files.set(key, value);
                    }
                }
            }

            const parsed = parse(urlparams.toString(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            // @ts-ignore Very bad hack
            context.req.parseBody = <T extends BodyData = BodyData>() =>
                Promise.resolve({
                    ...parsed,
                    ...Object.fromEntries(files),
                } as T);

            context.req.formData = () =>
                // @ts-ignore I'm so sorry for this
                Promise.resolve({
                    ...parsed,
                    ...Object.fromEntries(files),
                });
            // @ts-ignore I'm so sorry for this
            context.req.bodyCache.formData = {
                ...parsed,
                ...Object.fromEntries(files),
            };
        } else if (contentType?.includes("application/x-www-form-urlencoded")) {
            const parsed = parse(await context.req.text(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            context.req.parseBody = <T extends BodyData = BodyData>() =>
                Promise.resolve(parsed as T);
            // @ts-ignore Very bad hack
            context.req.formData = () => Promise.resolve(parsed);
            // @ts-ignore I'm so sorry for this
            context.req.bodyCache.formData = parsed;
        }
        await next();
    });
};

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

// Fill in queries, formData and json
export const jsonOrForm = () => {
    return createMiddleware(async (context, next) => {
        const contentType = context.req.header("content-type");

        if (contentType?.includes("application/json")) {
            context.req.parseBody = async <T extends BodyData = BodyData>() =>
                (await context.req.json()) as T;
            context.req.bodyCache.formData = await context.req.json();
            context.req.formData = async () =>
                context.req.bodyCache.formData as FormData;
        } else if (contentType?.includes("application/x-www-form-urlencoded")) {
            const parsed = parse(await context.req.text(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            context.req.parseBody = <T extends BodyData = BodyData>() =>
                Promise.resolve(parsed as T);
            // @ts-ignore Very bad hack
            context.req.formData = () => Promise.resolve(parsed);
            // @ts-ignore I'm so sorry for this
            context.req.bodyCache.formData = parsed;
        } else if (contentType?.includes("multipart/form-data")) {
            // Get it as a query format to pass on to qs, then insert back files
            const formData = await context.req.formData();
            const urlparams = new URLSearchParams();
            const files = new Map<string, File>();
            for (const [key, value] of [...formData.entries()]) {
                if (Array.isArray(value)) {
                    for (const val of value) {
                        urlparams.append(key, val);
                    }
                } else if (!(value instanceof File)) {
                    urlparams.append(key, String(value));
                } else {
                    if (!files.has(key)) {
                        files.set(key, value);
                    }
                }
            }

            const parsed = parse(urlparams.toString(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            // @ts-ignore Very bad hack
            context.req.parseBody = <T extends BodyData = BodyData>() =>
                Promise.resolve({
                    ...parsed,
                    ...Object.fromEntries(files),
                } as T);

            context.req.formData = () =>
                // @ts-ignore I'm so sorry for this
                Promise.resolve({
                    ...parsed,
                    ...Object.fromEntries(files),
                });
            // @ts-ignore I'm so sorry for this
            context.req.bodyCache.formData = {
                ...parsed,
                ...Object.fromEntries(files),
            };
        }
        await next();
    });
};
