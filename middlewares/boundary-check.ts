import { errorResponse } from "@/response";
import { createMiddleware } from "hono/factory";

export const boundaryCheck = createMiddleware(async (context, next) => {
    // Checks that FormData boundary is present
    const contentType = context.req.header("content-type");

    if (contentType?.includes("multipart/form-data")) {
        if (!contentType.includes("boundary")) {
            return errorResponse(
                "You are sending a request with a multipart/form-data content type but without a boundary. Please include a boundary in the Content-Type header. For more information, visit https://stackoverflow.com/questions/3508338/what-is-the-boundary-in-multipart-form-data",
                400,
            );
        }
    }

    await next();
});
