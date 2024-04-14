import { errorResponse, jsonResponse, response } from "@response";
import type { MatchedRoute } from "bun";
import { type Config, config } from "config-manager";
import { LogLevel, type LogManager, type MultiLogManager } from "log-manager";
import { RequestParser } from "request-parser";
import { type ZodType, z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
    type AuthData,
    type UserWithRelations,
    getFromRequest,
} from "~database/entities/User";

type MaybePromise<T> = T | Promise<T>;
type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

export type RouteHandler<
    RouteMeta extends APIRouteMetadata,
    ZodSchema extends ZodType,
> = (
    req: Request,
    matchedRoute: MatchedRoute,
    extraData: {
        auth: {
            // If the route doesn't require authentication, set the type to UserWithRelations | null
            // Otherwise set to UserWithRelations
            user: RouteMeta["auth"]["required"] extends true
                ? UserWithRelations
                : UserWithRelations | null;
            token: RouteMeta["auth"]["required"] extends true
                ? string
                : string | null;
        };
        parsedRequest: z.infer<ZodSchema>;
        configManager: {
            getConfig: () => Promise<Config>;
        };
    },
) => MaybePromise<Response> | MaybePromise<object>;

export interface APIRouteMetadata {
    allowedMethods: HttpVerb[];
    ratelimits: {
        max: number;
        duration: number;
    };
    route: string;
    auth: {
        required: boolean;
        requiredOnMethods?: HttpVerb[];
        oauthPermissions?: string[];
    };
}

export interface APIRouteExports {
    meta: APIRouteMetadata;
    schema: z.AnyZodObject;
    default: RouteHandler<APIRouteMetadata, z.AnyZodObject>;
}

const exampleZodSchema = z.object({
    allowedMethods: z.array(z.string()),
    ratelimits: z.object({
        max: z.number(),
        duration: z.number(),
    }),
    route: z.string(),
    auth: z.object({
        required: z.boolean(),
    }),
});

export const processRoute = async (
    matchedRoute: MatchedRoute,
    request: Request,
    logger: LogManager | MultiLogManager,
): Promise<Response> => {
    if (request.method === "OPTIONS") {
        return response();
    }

    const route: APIRouteExports | null = await import(
        matchedRoute.filePath
    ).catch(() => null);

    if (!route) {
        return errorResponse("Route not found", 404);
    }

    // Check if the request method is allowed
    if (!route.meta.allowedMethods.includes(request.method as HttpVerb)) {
        return errorResponse("Method not allowed", 405);
    }

    let auth: AuthData | null = null;

    if (
        route.meta.auth.required ||
        route.meta.auth.requiredOnMethods?.includes(request.method as HttpVerb)
    ) {
        auth = await getFromRequest(request);

        if (!auth.user) {
            return errorResponse(
                "Unauthorized: access to this method requires an authenticated user",
                401,
            );
        }
    }

    // Check if Content-Type header is missing if there is a body
    if (request.body) {
        if (!request.headers.has("Content-Type")) {
            return errorResponse(
                `Content-Type header is missing but required on method ${request.method}`,
                400,
            );
        }
    }

    const parsedRequest = await new RequestParser(request)
        .toObject()
        .catch(async (err) => {
            await logger.logError(
                LogLevel.ERROR,
                "Server.RouteRequestParser",
                err as Error,
            );
            return null;
        });

    if (!parsedRequest) {
        return errorResponse(
            "The request could not be parsed, it may be malformed",
            400,
        );
    }

    const parsingResult = route.schema?.safeParse(parsedRequest);

    if (parsingResult && !parsingResult.success) {
        // Return a 422 error with the first error message
        return errorResponse(fromZodError(parsingResult.error).toString(), 422);
    }

    try {
        const output = await route.default(request, matchedRoute, {
            auth: {
                token: auth?.token ?? null,
                user: auth?.user ?? null,
            },
            parsedRequest: parsingResult
                ? (parsingResult.data as z.infer<typeof route.schema>)
                : parsedRequest,
            configManager: {
                getConfig: async () => config as Config,
            },
        });

        // If the output is a normal JS object and not a Response, convert it to a jsonResponse
        if (!(output instanceof Response)) {
            return jsonResponse(output);
        }

        return output;
    } catch (err) {
        await logger.log(
            LogLevel.DEBUG,
            "Server.RouteHandler",
            (err as Error).toString(),
        );
        await logger.logError(
            LogLevel.ERROR,
            "Server.RouteHandler",
            err as Error,
        );

        return errorResponse(
            `A server error occured: ${(err as Error).message}`,
            500,
        );
    }
};
