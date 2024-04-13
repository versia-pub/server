import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { userToAPI } from "~database/entities/User";
import { db } from "~drizzle/db";
import { user } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["DELETE"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/profile/header",
    auth: {
        required: true,
    },
});

/**
 * Deletes a user header
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const { user: self } = extraData.auth;

    if (!self) return errorResponse("Unauthorized", 401);

    // Delete user header
    await db.update(user).set({ header: "" }).where(eq(user.id, self.id));

    return jsonResponse(
        userToAPI({
            ...self,
            header: "",
        }),
    );
});
