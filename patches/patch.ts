import { $ } from "bun";

// Replace all occurrences of 'Deno' with '{}' in node_modules/@logtape/logtape/logtape/filesink.deno.js
// LogTape assumes a Deno global exists which causes it to break in Bun
await $`sed -i 's/Deno/{}/g' '${import.meta.dir}/../node_modules/@logtape/logtape/logtape/filesink.deno.js'`;
