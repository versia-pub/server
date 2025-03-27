import { join } from "node:path";
import { handleZodError } from "@/api";
import { applyToHono } from "@/bull-board.ts";
import { configureLoggers } from "@/loggers";
import { sentry } from "@/sentry";
import { OpenAPIHono } from "@hono/zod-openapi";
/* import { prometheus } from "@hono/prometheus"; */
import { getLogger } from "@logtape/logtape";
import { apiReference } from "@scalar/hono-api-reference";
import chalk from "chalk";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { Youch } from "youch";
import { config } from "~/config.ts";
import pkg from "~/package.json" with { type: "application/json" };
import { ApiError } from "./classes/errors/api-error.ts";
import { PluginLoader } from "./classes/plugin/loader.ts";
import { agentBans } from "./middlewares/agent-bans.ts";
import { boundaryCheck } from "./middlewares/boundary-check.ts";
import { ipBans } from "./middlewares/ip-bans.ts";
import { logger } from "./middlewares/logger.ts";
import { rateLimit } from "./middlewares/rate-limit.ts";
import { routes } from "./routes.ts";
import type { ApiRouteExports, HonoEnv } from "./types/api.ts";

export const appFactory = async (): Promise<OpenAPIHono<HonoEnv>> => {
    await configureLoggers();
    const serverLogger = getLogger("server");

    const app = new OpenAPIHono<HonoEnv>({
        strict: false,
        defaultHook: handleZodError,
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

    /* app.use("*", registerMetrics);
    app.get("/metrics", printMetrics); */
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

    serverLogger.info`Loading plugins`;

    const time1 = performance.now();

    const loader = new PluginLoader();

    const plugins = await loader.loadPlugins(
        join(process.cwd(), "plugins"),
        config.plugins?.autoload ?? true,
        config.plugins?.overrides.enabled,
        config.plugins?.overrides.disabled,
    );

    await PluginLoader.addToApp(plugins, app, serverLogger);

    const time2 = performance.now();

    serverLogger.info`Plugins loaded in ${`${chalk.gray(
        (time2 - time1).toFixed(2),
    )}ms`}`;

    app.doc31("/openapi.json", {
        openapi: "3.1.0",
        info: {
            title: "Versia Server API",
            version: pkg.version,
            license: {
                name: "AGPL-3.0",
                url: "https://www.gnu.org/licenses/agpl-3.0.html",
            },
            contact: pkg.author,
        },
    });
    app.doc("/openapi.3.0.0.json", {
        openapi: "3.0.0",
        info: {
            title: "Versia Server API",
            version: pkg.version,
            license: {
                name: "AGPL-3.0",
                url: "https://www.gnu.org/licenses/agpl-3.0.html",
            },
            contact: pkg.author,
        },
    });
    app.get(
        "/docs",
        apiReference({
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

        sentry?.captureException(error);
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
