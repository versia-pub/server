import { Scalar } from "@scalar/hono-api-reference";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { generateSpecs } from "hono-openapi";
import { Youch } from "youch";
import { applyToHono } from "@/bull-board.ts";
import pkg from "../../package.json" with { type: "application/json" };
import type { ApiRouteExports, HonoEnv } from "../../types/api.ts";
import { agentBans } from "./middlewares/agent-bans.ts";
import { boundaryCheck } from "./middlewares/boundary-check.ts";
import { ipBans } from "./middlewares/ip-bans.ts";
import { logger } from "./middlewares/logger.ts";
import { rateLimit } from "./middlewares/rate-limit.ts";
import { routes } from "./routes.ts";

export const appFactory = async (): Promise<Hono<HonoEnv>> => {
    const app = new Hono<HonoEnv>({
        strict: false,
    });

    app.use(ipBans);
    app.use(agentBans);
    app.use(logger);
    app.use(boundaryCheck);
    app.use(
        "/api/*",
        secureHeaders({
            contentSecurityPolicy: {
                // We will not be returning HTML, so everything should be blocked
                defaultSrc: ["'none'"],
                scriptSrc: ["'none'"],
                styleSrc: ["'none'"],
                imgSrc: ["'none'"],
                connectSrc: ["'none'"],
                fontSrc: ["'none'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'none'"],
                frameSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'none'"],
                formAction: ["'none'"],
                childSrc: ["'none'"],
                workerSrc: ["'none'"],
                manifestSrc: ["'none'"],
            },
            referrerPolicy: "no-referrer",
            xFrameOptions: "DENY",
            xContentTypeOptions: "nosniff",
            crossOriginEmbedderPolicy: "require-corp",
            crossOriginOpenerPolicy: "same-origin",
            crossOriginResourcePolicy: "same-origin",
        }),
    );
    app.use(
        prettyJSON({
            space: 4,
        }),
    );
    app.use(
        cors({
            origin: "*",
            allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
            credentials: true,
        }),
    );
    app.use(
        createMiddleware<HonoEnv>(async (context, next) => {
            context.set("config", config);

            await next();
        }),
    );

    // Set default ratelimits to 100 requests per minute
    app.use("/api/*", rateLimit(100));
    app.use("/api/v1/media", rateLimit(40));
    app.use("/api/v1/media/*", rateLimit(40));
    app.use("/api/v2/media", rateLimit(40));
    app.use("/api/v1/timelines/*", rateLimit(40));
    app.use("/api/v1/push/*", rateLimit(10));

    // Disabled as federation now checks for this
    // app.use(urlCheck);

    // Inject own filesystem router
    for (const [, path] of Object.entries(routes)) {
        // use app.get(path, handler) to add routes
        const route: ApiRouteExports = await import(path);

        if (!route.default) {
            continue;
        }

        route.default(app);
    }

    const openApiSpecs = await generateSpecs(app, {
        documentation: {
            info: {
                title: "Versia Server API",
                version: pkg.version,
                license: {
                    name: "AGPL-3.0",
                    url: "https://www.gnu.org/licenses/agpl-3.0.html",
                },
                contact: pkg.author,
            },
        },
    });

    app.get("/openapi.json", (context) => {
        return context.json(openApiSpecs, 200);
    });

    app.get(
        "/docs",
        Scalar({
            theme: "deepSpace",
            hideClientButton: true,
            pageTitle: "Versia Server API",
            url: "/openapi.json",
        }),
    );
    applyToHono(app);

    app.options("*", (context) => {
        return context.body(null, 204);
    });

    app.all(
        "*",
        serveStatic({
            root: config.frontend.path,
        }),
    );
    // Fallback for SPAs, in case we've hit a route that is client-side
    app.all(
        "*",
        serveStatic({
            root: config.frontend.path,
            path: "index.html",
        }),
    );

    app.onError(async (error, c) => {
        if (error instanceof ApiError) {
            return c.json(
                {
                    error: error.message,
                    details: error.details,
                },
                error.status,
            );
        }

        const youch = new Youch();
        console.error(await youch.toANSI(error));

        return c.json(
            {
                error: "A server error occured",
                name: error.name,
                message: error.message,
            },
            500,
        );
    });

    return app;
};

export type App = Awaited<ReturnType<typeof appFactory>>;
