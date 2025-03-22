import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { serveStatic } from "hono/bun";
import { deliveryQueue } from "~/classes/queues/delivery";
import { fetchQueue } from "~/classes/queues/fetch";
import { inboxQueue } from "~/classes/queues/inbox";
import { mediaQueue } from "~/classes/queues/media";
import { pushQueue } from "~/classes/queues/push";
import { config } from "~/config.ts";
import pkg from "~/package.json";
import type { HonoEnv } from "~/types/api";

export const applyToHono = (app: OpenAPIHono<HonoEnv>): void => {
    const serverAdapter = new HonoAdapter(serveStatic);

    createBullBoard({
        queues: [
            new BullMQAdapter(inboxQueue),
            new BullMQAdapter(deliveryQueue),
            new BullMQAdapter(fetchQueue),
            new BullMQAdapter(pushQueue),
            new BullMQAdapter(mediaQueue),
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
        },
    });

    serverAdapter.setBasePath("/admin/queues");
    // @ts-ignore Causes infinite instantiation for some reason
    app.route("/admin/queues", serverAdapter.registerPlugin());
};
