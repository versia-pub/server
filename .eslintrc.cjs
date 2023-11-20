module.exports = {
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/strict-type-checked",
		"plugin:@typescript-eslint/stylistic",
		"plugin:prettier/recommended",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: "./tsconfig.json",
	},
	ignorePatterns: ["node_modules/", "dist/", ".eslintrc.cjs"],
	plugins: ["@typescript-eslint"],
	root: true,
	rules: {
		"@typescript-eslint/no-unsafe-assignment": "off",
		"@typescript-eslint/no-unsafe-argument": "off",
		"@typescript-eslint/no-explicit-any": "off",
	},
};
