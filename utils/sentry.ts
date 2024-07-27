import * as Sentry from "@sentry/bun";
import { config } from "config-manager";
import pkg from "~/package.json";

const sentryInstance =
    config.logging.sentry.enabled &&
    Sentry.init({
        dsn: config.logging.sentry.dsn,
        debug: config.logging.sentry.debug,
        sampleRate: config.logging.sentry.sample_rate,
        maxBreadcrumbs: config.logging.sentry.max_breadcrumbs,
        tracesSampleRate: config.logging.sentry.traces_sample_rate,
        environment: config.logging.sentry.environment,
        tracePropagationTargets:
            config.logging.sentry.trace_propagation_targets,
        release: Bun.env.GIT_COMMIT
            ? `${pkg.version}-${Bun.env.GIT_COMMIT}`
            : pkg.version,
        integrations: [Sentry.extraErrorDataIntegration()],
    });

export const sentry = sentryInstance || undefined;
