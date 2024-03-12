import { fileURLToPath } from "url";

/**
 * Determines whether a module is the entry point for the running node process.
 * This works for both CommonJS and ES6 environments.
 *
 * ### CommonJS
 * ```js
 * if (moduleIsEntry(module)) {
 *     console.log('WOO HOO!!!');
 * }
 * ```
 *
 * ### ES6
 * ```js
 * if (moduleIsEntry(import.meta.url)) {
 *     console.log('WOO HOO!!!');
 * }
 * ```
 */
export const moduleIsEntry = (moduleOrImportMetaUrl: NodeModule | string) => {
	if (typeof moduleOrImportMetaUrl === "string") {
		return process.argv[1] === fileURLToPath(moduleOrImportMetaUrl);
	}

	if (typeof require !== "undefined" && "exports" in moduleOrImportMetaUrl) {
		return require.main === moduleOrImportMetaUrl;
	}

	return false;
};
