import { join } from "node:path";
import { FileSystemRouter } from "bun";
import { cwdFromEntrypoint } from "@/lib.ts";
// Returns the route filesystem path when given a URL
export const routeMatcher = new FileSystemRouter({
    style: "nextjs",
    dir: `${cwdFromEntrypoint()}/api`,
    fileExtensions: [".ts", ".js"],
});

export const routes = Object.fromEntries(
    Object.entries(routeMatcher.routes)
        .filter(([route]) => !route.endsWith(".test"))
        .map(([route, path]) => [
            route,
            path.replace(join(cwdFromEntrypoint()), "."),
        ]),
) as Record<string, string>;
