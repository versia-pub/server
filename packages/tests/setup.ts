import { setupDatabase } from "@versia-server/kit/db";
import { deleteOldTestUsers } from "./index.ts";

await setupDatabase();
await deleteOldTestUsers();

// Start workers
await import("../../worker.ts");
