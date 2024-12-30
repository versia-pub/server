import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONObject } from "hono/utils/types";

/**
 * API Error
 *
 * Custom error class used to throw errors in the API. Includes a status code, a message and an optional description.
 * @extends Error
 */
export class ApiError extends Error {
    /**
     * @param {StatusCode} status - The status code of the error
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
}
