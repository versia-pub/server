import { zodToJsonSchema } from "zod-to-json-schema";

await import("~/config.ts");

// This is an awkward way to avoid import cycles for some reason
await (async () => {
    const { ConfigSchema } = await import("./schema.ts");

    const jsonSchema = zodToJsonSchema(ConfigSchema, {});

    console.write(`${JSON.stringify(jsonSchema, null, 4)}\n`);
})();
