import { join } from "node:path";
import { handleZodError } from "@/api";
import { sentry } from "@/sentry";
import { cors } from "@hono/hono/cors";
import { createMiddleware } from "@hono/hono/factory";
import { prettyJSON } from "@hono/hono/pretty-json";
import { secureHeaders } from "@hono/hono/secure-headers";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
/* import { prometheus } from "@hono/prometheus";
 */ import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import type { ValidationError } from "zod-validation-error";
import pkg from "~/package.json" with { type: "application/json" };
import { config } from "~/packages/config-manager/index";
import { PluginLoader } from "./classes/plugin/loader";
import { agentBans } from "./middlewares/agent-bans";
import { bait } from "./middlewares/bait";
import { boundaryCheck } from "./middlewares/boundary-check";
import { ipBans } from "./middlewares/ip-bans";
import { logger } from "./middlewares/logger";
import { routes } from "./routes";
import type { ApiRouteExports, HonoEnv } from "./types/api";
import { configureLoggers } from "@/loggers";

export const appFactory = async () => {
    await configureLoggers();
    const serverLogger = getLogger("server");

    const app = new OpenAPIHono<HonoEnv>({
        strict: false,
        defaultHook: handleZodError,
    });

    /* const { printMetrics, registerMetrics } = prometheus({
        collectDefaultMetrics: true,
        metricOptions: {
            requestsTotal: {
                customLabels: {
                    content_type: (c) =>
                        c.res.headers.get("content-type") ?? "unknown",
                },
            },
        },
    }); */

    app.use(ipBans);
    app.use(agentBans);
    app.use(bait);
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

    /* app.use("*", registerMetrics);
    app.get("/metrics", printMetrics); */
    // Disabled as federation now checks for this
    // app.use(urlCheck);

    // Inject own filesystem router
    for (const [, path] of Object.entries(routes)) {
        // use app.get(path, handler) to add routes
        const route: ApiRouteExports = await import(path);

        if (!(route.meta && route.default)) {
            throw new Error(`Route ${path} does not have the correct exports.`);
        }

        route.default(app);
    }

    serverLogger.info`Loading plugins`;

    const loader = new PluginLoader();

    const plugins = await loader.loadPlugins(join(process.cwd(), "plugins"));

    for (const data of plugins) {
        serverLogger.info`Loading plugin ${chalk.blueBright(data.manifest.name)} ${chalk.blueBright(data.manifest.version)} ${chalk.gray(`[${plugins.indexOf(data) + 1}/${plugins.length}]`)}`;
        try {
            // biome-ignore lint/complexity/useLiteralKeys: loadConfig is a private method
            await data.plugin["_loadConfig"](
                config.plugins?.[data.manifest.name],
            );
        } catch (e) {
            serverLogger.fatal`Plugin configuration is invalid: ${chalk.redBright(e as ValidationError)}`;
            serverLogger.fatal`Put your configuration at ${chalk.blueBright(
                "plugins.<plugin-name>",
            )}`;
            serverLogger.fatal`Press Ctrl+C to exit`;

            // Hang until Ctrl+C is pressed
            await Bun.sleep(Number.POSITIVE_INFINITY);
            process.exit();
        }

        // biome-ignore lint/complexity/useLiteralKeys: AddToApp is a private method
        await data.plugin["_addToApp"](app);
    }

    serverLogger.info`Plugins loaded`;

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
    app.get("/docs", swaggerUI({ url: "/openapi.json" }));

    app.options("*", (context) => {
        return context.text("", 204);
    });

    app.all("*", async (context) => {
        const replacedUrl = new URL(
            new URL(context.req.url).pathname,
            config.frontend.url,
        ).toString();

        serverLogger.debug`Proxying ${replacedUrl}`;

        const proxy = await fetch(replacedUrl, {
            headers: {
                // Include for SSR
                "X-Forwarded-Host": `${config.http.bind}:${config.http.bind_port}`,
                "Accept-Encoding": "identity",
            },
            redirect: "manual",
        }).catch((e) => {
            serverLogger.error`${e}`;
            sentry?.captureException(e);
            serverLogger.error`The Frontend is not running or the route is not found: ${replacedUrl}`;
            return null;
        });

        proxy?.headers.set("Cache-Control", "max-age=31536000");

        if (!proxy || proxy.status === 404) {
            return context.json(
                {
                    error: "Route not found on proxy or API route. Are you using the correct HTTP method?",
                },
                404,
            );
        }

        // Disable CSP upgrade-insecure-requests if an .onion domain is used
        if (new URL(context.req.url).hostname.endsWith(".onion")) {
            proxy.headers.set(
                "Content-Security-Policy",
                proxy.headers
                    .get("Content-Security-Policy")
                    ?.replace("upgrade-insecure-requests;", "") ?? "",
            );
        }

        return proxy;
    });

    app.onError((error, c) => {
        serverLogger.error`${error}`;
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
