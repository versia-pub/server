import { z } from "@hono/zod-openapi";

export const Id = z.string().uuid();
