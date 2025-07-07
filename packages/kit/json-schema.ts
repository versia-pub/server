import * as z from "zod/v4";
import { manifestSchema } from "./schema.ts";

const jsonSchema = z.toJSONSchema(manifestSchema);

console.write(`${JSON.stringify(jsonSchema, null, 4)}\n`);
