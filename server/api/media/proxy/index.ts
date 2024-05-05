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
    url: z.string(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { url } = extraData.parsedRequest;

        return fetch(url);
    },
);
