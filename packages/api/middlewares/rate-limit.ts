import type { ApiError } from "@versia/kit";
import { env } from "bun";
import type { MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import type { z } from "zod";
import type { HonoEnv } from "~/types/api";

// Not exported by hono-rate-limiter
// So we define it ourselves
type RateLimitEnv = HonoEnv & {
    Variables: {
        rateLimit: {
            limit: number;
            remaining: number;
            resetTime: Date;
        };
    };
};

export const rateLimit = (
    limit: number,
    windowMs = 60 * 1000,
): MiddlewareHandler<RateLimitEnv> =>
    env.DISABLE_RATE_LIMIT === "true"
        ? (_, next): Promise<void> => next()
        : rateLimiter<RateLimitEnv>({
              keyGenerator: (c): string => c.req.path,
              message: (c): z.infer<typeof ApiError.zodSchema> => ({
                  error: "Too many requests, please try again later.",
                  details: {
                      limit: c.get("rateLimit").limit,
                      remaining: c.get("rateLimit").remaining,
                      reset: c.get("rateLimit").resetTime.toISOString(),
                      resetInMs:
                          c.get("rateLimit").resetTime.getTime() - Date.now(),
                  },
              }),
              windowMs,
              limit,
          });
