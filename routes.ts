import { join } from "node:path";
// Returns the route filesystem path when given a URL
export const routeMatcher = new Bun.FileSystemRouter({
    style: "nextjs",
    dir: `${process.cwd()}/api`,
    fileExtensions: [".ts", ".js"],
});

export const routes = Object.fromEntries(
    Object.entries(routeMatcher.routes)
        .filter(([route]) => !route.endsWith(".test"))
        .map(([route, path]) => [
            route,
            path.replace(join(process.cwd()), "."),
        ]),
) as Record<string, string>;
