import { setupDatabase } from "~/drizzle/db";
import { deleteOldTestUsers } from "./utils.ts";

await setupDatabase();
await deleteOldTestUsers();

// Start workers
await import("~/worker.ts");
