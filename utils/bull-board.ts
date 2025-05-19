import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import type { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { deliveryQueue } from "~/classes/queues/delivery";
import { fetchQueue } from "~/classes/queues/fetch";
import { inboxQueue } from "~/classes/queues/inbox";
import { mediaQueue } from "~/classes/queues/media";
import { pushQueue } from "~/classes/queues/push";
import { relationshipQueue } from "~/classes/queues/relationships";
import { config } from "~/config.ts";
import pkg from "~/package.json";
import type { HonoEnv } from "~/types/api";

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
    // @ts-expect-error idk why it's like this
    app.route("/admin/queues", serverAdapter.registerPlugin());
};
