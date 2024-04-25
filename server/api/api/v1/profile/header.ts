import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import { db } from "~drizzle/db";
import { Users } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

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
    await db.update(Users).set({ header: "" }).where(eq(Users.id, self.id));

    return jsonResponse({
        ...(await User.fromId(self.id))?.toAPI(),
        header: "",
    });
});
