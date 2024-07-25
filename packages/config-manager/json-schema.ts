import { zodToJsonSchema } from "zod-to-json-schema";
import { configValidator } from "./config.type";

const jsonSchema = zodToJsonSchema(configValidator);

console.write(`${JSON.stringify(jsonSchema, null, 4)}\n`);
