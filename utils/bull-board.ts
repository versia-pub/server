import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/hono/bun";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";
import type { HonoEnv } from "~/types/api";
import { deliveryQueue, inboxQueue } from "~/worker";

export const applyToHono = (app: OpenAPIHono<HonoEnv>): void => {
    const serverAdapter = new HonoAdapter(serveStatic);

    createBullBoard({
        queues: [
            new BullMQAdapter(inboxQueue),
            new BullMQAdapter(deliveryQueue),
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
                    path:
                        config.instance.logo ??
                        "https://cdn.versia.pub/branding/icon.svg",
                    height: 40,
                },
            },
        },
    });

    serverAdapter.setBasePath("/admin/queues");
    app.route("/admin/queues", serverAdapter.registerPlugin());
};
