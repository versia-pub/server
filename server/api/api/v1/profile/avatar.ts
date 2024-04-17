import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { userToAPI } from "~database/entities/User";
import { db } from "~drizzle/db";
import { Users } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["DELETE"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/profile/avatar",
    auth: {
        required: true,
    },
});

/**
 * Deletes a user avatar
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const { user: self } = extraData.auth;

    if (!self) return errorResponse("Unauthorized", 401);

    await db.update(Users).set({ avatar: "" }).where(eq(Users.id, self.id));

    return jsonResponse(
        userToAPI({
            ...self,
            avatar: "",
        }),
    );
});
