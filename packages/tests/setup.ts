import { setupDatabase } from "@versia/kit/db";
import { deleteOldTestUsers } from "./index.ts";

await setupDatabase();
await deleteOldTestUsers();

// Start workers
await import("~/packages/worker/index.ts");
