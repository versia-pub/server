import { apiRoute, applyConfig } from "@api";
import { errorResponse, response } from "@response";
import { z } from "zod";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/media/proxy",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export const schema = z.object({
    // Base64 encoded URL
    url: z
        .string()
        .transform((val) => Buffer.from(val, "base64url").toString()),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { url } = extraData.parsedRequest;

        // Check if URL is valid
        if (!URL.canParse(url))
            return errorResponse(
                "Invalid URL (it should be encoded as base64url",
                400,
            );

        return fetch(url).then((res) => {
            return response(res.body, res.status, res.headers.toJSON());
        });
    },
);
