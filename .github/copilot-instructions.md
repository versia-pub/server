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

Our codebase uses Drizzle as an ORM, which is exposed in the `@versia-server/kit/db` and `@versia-server/kit/tables` packages. This project uses a monorepo structure with Bun as the package manager.

The app has two modes: worker and API. The worker mode is used for background tasks, while the API mode serves HTTP requests. The entry point for the worker is `worker.ts`, and for the API, it is `api.ts`.

Run the typechecker with `bun run typecheck` to ensure that all TypeScript code is type-checked correctly. Run tests with `bun test` to ensure that all tests pass. Run the linter and formatter with `bun lint` to ensure that the code adheres to our style guidelines, and `bun lint --write` to automatically fix minor/formatting issues.

Cover all new functionality with tests, and ensure that all tests pass before submitting your code.
