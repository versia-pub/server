import * as Sentry from "@sentry/bun";
import { config } from "@versia-server/config";
import { env } from "bun";
import pkg from "~/package.json" with { type: "json" };

const sentryInstance =
    config.logging.sentry &&
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
    });

export const sentry = sentryInstance || undefined;
