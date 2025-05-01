import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONObject } from "hono/utils/types";
import type { DescribeRouteOptions } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";

/**
 * API Error
 *
 * Custom error class used to throw errors in the API. Includes a status code, a message and an optional description.
 * @extends Error
 */
export class ApiError extends Error {
    /**
     * @param {ContentfulStatusCode} status - The status code of the error
     * @param {string} message - The message of the error
     * @param {string | JSONObject} [details] - The description of the error
     */
    public constructor(
        public status: ContentfulStatusCode,
        public message: string,
        public details?: string | JSONObject,
    ) {
        super(message);
        this.name = "ApiError";
    }

    public static zodSchema = z.object({
        error: z.string(),
        details: z
            .string()
            .or(z.record(z.string(), z.string().or(z.number())))
            .optional(),
    });

    public get schema(): NonNullable<
        DescribeRouteOptions["responses"]
    >[number] {
        return {
            description: this.message,
            content: {
                "application/json": {
                    schema: resolver(ApiError.zodSchema),
                },
            },
        };
    }

    public static missingAuthentication(): ApiError {
        return new ApiError(
            401,
            "Missing authentication",
            "The Authorization header is missing or could not be parsed.",
        );
    }

    public static forbidden(): ApiError {
        return new ApiError(
            403,
            "Missing permissions",
            "You do not have permission to access or modify this resource.",
        );
    }

    public static notFound(): ApiError {
        return new ApiError(
            404,
            "Not found",
            "The requested resource could not be found.",
        );
    }

    public static noteNotFound(): ApiError {
        return new ApiError(
            404,
            "Note not found",
            "The requested note could not be found.",
        );
    }

    public static accountNotFound(): ApiError {
        return new ApiError(
            404,
            "Account not found",
            "The requested account could not be found.",
        );
    }

    public static roleNotFound(): ApiError {
        return new ApiError(
            404,
            "Role not found",
            "The requested role could not be found.",
        );
    }

    public static instanceNotFound(): ApiError {
        return new ApiError(
            404,
            "Instance not found",
            "The requested instance could not be found.",
        );
    }

    public static likeNotFound(): ApiError {
        return new ApiError(
            404,
            "Like not found",
            "The requested like could not be found.",
        );
    }

    public static pushSubscriptionNotFound(): ApiError {
        return new ApiError(
            404,
            "Push subscription not found",
            "No push subscription associated with this access token",
        );
    }

    public static tokenNotFound(): ApiError {
        return new ApiError(
            404,
            "Token not found",
            "The requested token could not be found.",
        );
    }

    public static mediaNotFound(): ApiError {
        return new ApiError(
            404,
            "Media not found",
            "The requested media could not be found.",
        );
    }

    public static applicationNotFound(): ApiError {
        return new ApiError(
            404,
            "Application not found",
            "The requested application could not be found.",
        );
    }

    public static emojiNotFound(): ApiError {
        return new ApiError(
            404,
            "Emoji not found",
            "The requested emoji could not be found.",
        );
    }

    public static notificationNotFound(): ApiError {
        return new ApiError(
            404,
            "Notification not found",
            "The requested notification could not be found.",
        );
    }

    public static validationFailed(): ApiError {
        return new ApiError(422, "Invalid values in request");
    }

    public static internalServerError(): ApiError {
        return new ApiError(
            500,
            "Internal server error. This is likely a bug.",
        );
    }
}
