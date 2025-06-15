import { zodToJsonSchema } from "zod-to-json-schema";
import { ConfigSchema } from "./schema.ts";

const jsonSchema = zodToJsonSchema(ConfigSchema, {});

console.write(`${JSON.stringify(jsonSchema, null, 4)}\n`);
