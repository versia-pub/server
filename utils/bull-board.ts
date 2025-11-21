import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { RolePermission } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { User } from "@versia-server/kit/db";
import { deliveryQueue } from "@versia-server/kit/queues/delivery";
import { fetchQueue } from "@versia-server/kit/queues/fetch";
import { inboxQueue } from "@versia-server/kit/queues/inbox";
import { mediaQueue } from "@versia-server/kit/queues/media";
import { pushQueue } from "@versia-server/kit/queues/push";
import { relationshipQueue } from "@versia-server/kit/queues/relationships";
import type { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { HonoEnv } from "~/types/api.ts";
import pkg from "../package.json" with { type: "json" };

export const applyToHono = (app: Hono<HonoEnv>): void => {
    const serverAdapter = new HonoAdapter(serveStatic);

    createBullBoard({
        queues: [
            new BullMQAdapter(inboxQueue),
            new BullMQAdapter(deliveryQueue),
            new BullMQAdapter(fetchQueue),
            new BullMQAdapter(pushQueue),
            new BullMQAdapter(mediaQueue),
            new BullMQAdapter(relationshipQueue),
        ],
        serverAdapter,
        options: {
            uiConfig: {
                boardTitle: "Server Queues",
                favIcon: {
                    default: "/favicon.png",
                    alternative: "/favicon.ico",
                },
                boardLogo: {
                    path: config.instance.branding.logo?.origin ?? pkg.icon,
                    height: 40,
                },
            },
            uiBasePath: "node_modules/@bull-board/ui",
        },
    });

    serverAdapter.setBasePath("/admin/queues");
    app.route("/admin/queues", serverAdapter.registerPlugin());

    app.use("/admin/queues/api/*", async (context, next) => {
        const jwtCookie = getCookie(context, "jwt");

        if (!jwtCookie) {
            throw new ApiError(401, "Missing JWT cookie");
        }

        const result = await verify(jwtCookie, config.authentication.key);

        const { sub } = result;

        if (!sub) {
            throw new ApiError(401, "Invalid JWT (no sub)");
        }

        const user = await User.fromId(sub as string);

        if (!user?.hasPermission(RolePermission.ManageInstanceFederation)) {
            throw new ApiError(
                403,
                `Missing '${RolePermission.ManageInstanceFederation}' permission`,
            );
        }

        await next();
    });
};
