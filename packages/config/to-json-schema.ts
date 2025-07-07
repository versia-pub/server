import * as z from "zod/v4";
import { ConfigSchema } from "./index.ts";

const jsonSchema = z.toJSONSchema(ConfigSchema);

console.write(`${JSON.stringify(jsonSchema, null, 4)}\n`);
