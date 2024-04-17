import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Notifications } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["DELETE"],
    route: "/api/v1/notifications/destroy_multiple",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["write:notifications"],
    },
});

export const schema = z.object({
    ids: z.array(z.string().regex(idValidator)),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;
        if (!user) return errorResponse("Unauthorized", 401);

        const { ids } = extraData.parsedRequest;

        await db
            .update(Notifications)
            .set({
                dismissed: true,
            })
            .where(inArray(Notifications.id, ids));

        return jsonResponse({});
    },
);
