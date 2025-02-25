We use full TypeScript and ESM with Bun for our codebase. Please include relevant and detailed JSDoc comments for all functions and classes. Use explicit type annotations for all variables and function return values, such as:

```typescript
/**
 * Adds two numbers together.
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
const add = (a: number, b: number): number => a + b;
```

We always write TypeScript with double quotes and four spaces for indentation, so when your responses include TypeScript code, please follow those conventions.

Our codebase uses Drizzle as an ORM, with custom abstractions in `classes/database/` for interacting with the database. The `@versia/kit/db` and `@versia/kit/tables` packages are aliases for these abstractions.
