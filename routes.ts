import { join } from "node:path";
import { cwd } from "node:process";
import { FileSystemRouter } from "bun";
// Returns the route filesystem path when given a URL
export const routeMatcher = new FileSystemRouter({
    style: "nextjs",
    dir: `${cwd()}/api`,
    fileExtensions: [".ts", ".js"],
});

export const routes = Object.fromEntries(
    Object.entries(routeMatcher.routes)
        .filter(([route]) => !route.endsWith(".test"))
        .map(([route, path]) => [route, path.replace(join(cwd()), ".")]),
) as Record<string, string>;
