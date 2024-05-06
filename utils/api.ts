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
} from "magic-regexp";
import { parse } from "qs";
import type {
    APIRouteExports,
    APIRouteMetadata,
    HttpVerb,
    RouteHandler,
} from "server-handler";
import type { z } from "zod";
import { fromZodError } from "zod-validation-error";
import type { Application } from "~database/entities/Application";
import { getFromHeader, getFromRequest } from "~database/entities/User";
import type { User } from "~packages/database-interface/user";

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

export const apiRoute = <
    Metadata extends APIRouteMetadata,
    ZodSchema extends Zod.AnyZodObject,
>(
    routeFunction: APIRouteExports["default"],
) => {
    return routeFunction;
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

        if (!auth) {
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

export const qs = () => {
    return createMiddleware(async (context, next) => {
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
        } else if (contentType?.includes("application/x-www-form-urlencoded")) {
            const parsed = parse(await context.req.text(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            // @ts-ignore Very bad hack
            context.req.formData = () => Promise.resolve(parsed);
            // @ts-ignore I'm so sorry for this
            context.req.bodyCache.formData = parsed;
        } else {
            const parsed = parse(await context.req.text(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            // @ts-ignore Very bad hack
            context.req.formData = () => Promise.resolve(parsed);
            // @ts-ignore I'm so sorry for this
            context.req.bodyCache.formData = parsed;
        }
        await next();
    });
};
