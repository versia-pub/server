import { setupDatabase } from "@versia/kit/db";
import { deleteOldTestUsers } from "./utils.ts";

await setupDatabase();
await deleteOldTestUsers();

// Start workers
await import("~/packages/worker/index.ts");
