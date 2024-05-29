import { setupDatabase } from "~/drizzle/db";
import { deleteOldTestUsers } from "./utils";

await setupDatabase();
await deleteOldTestUsers();
