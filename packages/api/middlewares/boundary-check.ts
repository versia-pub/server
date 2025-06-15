import { ApiError } from "@versia/kit";
import { createMiddleware } from "hono/factory";

export const boundaryCheck = createMiddleware(async (context, next) => {
    // Checks that FormData boundary is present
    const contentType = context.req.header("content-type");

    if (
        contentType?.includes("multipart/form-data") &&
        !contentType.includes("boundary")
    ) {
        throw new ApiError(
            400,
            "Missing FormData boundary",
            "You are sending a request with a multipart/form-data content type but without a boundary. Please include a boundary in the Content-Type header. For more information, visit https://stackoverflow.com/questions/3508338/what-is-the-boundary-in-multipart-form-data",
        );
    }

    await next();
});
