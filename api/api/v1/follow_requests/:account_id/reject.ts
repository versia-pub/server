import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sendFollowReject } from "~/classes/functions/user";
import { RolePermissions } from "~/drizzle/schema";
import { Relationship } from "~/packages/database-interface/relationship";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/follow_requests/:account_id/reject",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnFollows],
    },
});

export const schemas = {
    param: z.object({
        account_id: z.string().uuid(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.get("auth");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const { account_id } = context.req.valid("param");

            const account = await User.fromId(account_id);

            if (!account) {
                return context.json({ error: "Account not found" }, 404);
            }

            const oppositeRelationship = await Relationship.fromOwnerAndSubject(
                account,
                user,
            );

            await oppositeRelationship.update({
                requested: false,
                following: false,
            });

            const foundRelationship = await Relationship.fromOwnerAndSubject(
                user,
                account,
            );

            // Check if rejecting remote follow
            if (account.isRemote()) {
                // Federate follow reject
                await sendFollowReject(account, user);
            }

            return context.json(foundRelationship.toApi());
        },
    ),
);
