module.exports = {
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/strict-type-checked",
		"plugin:@typescript-eslint/stylistic",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: "./tsconfig.json",
	},
	ignorePatterns: ["node_modules/", "dist/", ".eslintrc.cjs"],
	plugins: ["@typescript-eslint"],
	root: true,
};
