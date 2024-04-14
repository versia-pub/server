import { config } from "config-manager";
import {
    anyOf,
    caseInsensitive,
    charIn,
    createRegExp,
    digit,
    exactly,
} from "magic-regexp";
import type { APIRouteMetadata, RouteHandler } from "server-handler";

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
    routeFunction: RouteHandler<Metadata, ZodSchema>,
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
