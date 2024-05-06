import { applyConfig, auth } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth),
        async (context) => {
            const { user: self } = context.req.valid("header");

            if (!self) return errorResponse("Unauthorized", 401);

            await db
                .update(Users)
                .set({ header: "" })
                .where(eq(Users.id, self.id));

            return jsonResponse({
                ...(await User.fromId(self.id))?.toAPI(),
                header: "",
            });
        },
    );
