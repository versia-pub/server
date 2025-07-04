import { zodToJsonSchema } from "zod-to-json-schema";
import { manifestSchema } from "./schema.ts";

const jsonSchema = zodToJsonSchema(manifestSchema);

console.write(`${JSON.stringify(jsonSchema, null, 4)}\n`);
