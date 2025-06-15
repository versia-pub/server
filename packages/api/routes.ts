import { FileSystemRouter } from "bun";
// Returns the route filesystem path when given a URL
export const routeMatcher = new FileSystemRouter({
    style: "nextjs",
    dir: "packages/api/routes",
    fileExtensions: [".ts", ".js"],
});

export const routes = Object.fromEntries(
    Object.entries(routeMatcher.routes)
        .filter(([route]) => !route.endsWith(".test"))
        .map(([route, path]) => [route, path]),
) as Record<string, string>;
