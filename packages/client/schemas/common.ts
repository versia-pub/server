import { z } from "@hono/zod-openapi";
import ISO6391 from "iso-639-1";

export const Id = z.string().uuid();

export const iso631 = z
    .enum(ISO6391.getAllCodes() as [string, ...string[]])
    .openapi("ISO631");

export const zBoolean = z
    .string()
    .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
    .or(z.boolean());
