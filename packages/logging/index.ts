import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getFileSink, getRotatingFileSink } from "@logtape/file";
import {
    configure,
    getConsoleSink,
    getLevelFilter,
    getLogger,
    type Sink,
    withFilter,
} from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";
import * as Sentry from "@sentry/bun";
import { config } from "@versia-server/config";
import { env } from "bun";
import pkg from "../../package.json" with { type: "json" };
import { consoleFormatter } from "./formatter.ts";

if (config.logging.file?.path) {
    // config.logging.file.path is a path to a file, create the directory if it doesn't exist
    await mkdir(dirname(config.logging.file.path), { recursive: true });
}

/**
 * Returns all configured sinks depending on the configuration.
 */
const getSinks = (): Record<"file" | "console" | "sentry", Sink> => {
    const sinks: Record<string, Sink> = {};

    if (config.logging.file) {
        if (config.logging.file.rotation) {
            sinks.file = getRotatingFileSink(config.logging.file.path, {
                maxFiles: config.logging.file.rotation.max_files,
                maxSize: config.logging.file.rotation.max_size,
            });
        } else {
            sinks.file = getFileSink(config.logging.file.path);
        }

        sinks.file = withFilter(
            sinks.file,
            getLevelFilter(config.logging.file.log_level),
        );
    }

    if (config.logging.sentry) {
        sinks.sentry = withFilter(
            getSentrySink(
                // @ts-expect-error LogTape hasn't been updated for Sentry v10
                Sentry.init({
                    dsn: config.logging.sentry.dsn.origin,
                    debug: config.logging.sentry.debug,
                    sampleRate: config.logging.sentry.sample_rate,
                    maxBreadcrumbs: config.logging.sentry.max_breadcrumbs,
                    tracesSampleRate: config.logging.sentry.traces_sample_rate,
                    environment: config.logging.sentry.environment,
                    tracePropagationTargets:
                        config.logging.sentry.trace_propagation_targets,
                    release: env.GIT_COMMIT
                        ? `${pkg.version}-${env.GIT_COMMIT}`
                        : pkg.version,
                    integrations: [Sentry.extraErrorDataIntegration()],
                }),
            ),
            getLevelFilter(config.logging.sentry.log_level),
        );
    }

    sinks.console = withFilter(
        getConsoleSink({
            formatter: consoleFormatter,
        }),
        getLevelFilter(config.logging.log_level),
    );

    return sinks;
};

const getSinkNames = (): ("file" | "console" | "sentry")[] => {
    const names = [] as ("file" | "console" | "sentry")[];

    if (config.logging.file) {
        names.push("file");
    }

    if (config.logging.sentry) {
        names.push("sentry");
    }

    names.push("console");

    return names;
};

await configure({
    reset: true,
    sinks: getSinks(),
    loggers: [
        {
            category: "server",
            sinks: getSinkNames(),
        },
        {
            category: ["federation", "inbox"],
            sinks: getSinkNames(),
        },
        {
            category: ["federation", "delivery"],
            sinks: getSinkNames(),
        },
        {
            category: ["federation", "bridge"],
            sinks: getSinkNames(),
        },
        {
            category: ["federation", "resolvers"],
            sinks: getSinkNames(),
        },
        {
            category: ["federation", "messaging"],
            sinks: getSinkNames(),
        },
        {
            category: "database",
            sinks: getSinkNames(),
        },
        {
            category: "webfinger",
            sinks: getSinkNames(),
        },
        {
            category: "sonic",
            sinks: getSinkNames(),
        },
        {
            category: ["logtape", "meta"],
            lowestLevel: "error",
        },
    ],
});

export const serverLogger = getLogger("server");
export const federationInboxLogger = getLogger(["federation", "inbox"]);
export const federationDeliveryLogger = getLogger(["federation", "delivery"]);
export const federationBridgeLogger = getLogger(["federation", "bridge"]);
export const federationResolversLogger = getLogger(["federation", "resolvers"]);
export const federationMessagingLogger = getLogger(["federation", "messaging"]);
export const databaseLogger = getLogger("database");
export const webfingerLogger = getLogger("webfinger");
export const sonicLogger = getLogger("sonic");
