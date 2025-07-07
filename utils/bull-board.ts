import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { config } from "@versia-server/config";
import { deliveryQueue } from "@versia-server/kit/queues/delivery";
import { fetchQueue } from "@versia-server/kit/queues/fetch";
import { inboxQueue } from "@versia-server/kit/queues/inbox";
import { mediaQueue } from "@versia-server/kit/queues/media";
import { pushQueue } from "@versia-server/kit/queues/push";
import { relationshipQueue } from "@versia-server/kit/queues/relationships";
import type { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { HonoEnv } from "~/types/api";
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
};
