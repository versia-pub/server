import { z } from "zod/v4";

export const f64 = z
    .number()
    .nonnegative()
    .max(2 ** 64 - 1);

export const u64 = z
    .number()
    .int()
    .nonnegative()
    .max(2 ** 64 - 1);

export const url = z.url();
