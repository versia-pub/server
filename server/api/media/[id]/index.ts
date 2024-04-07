import { apiRoute, applyConfig } from "@api";
import { errorResponse } from "@response";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/media/:id",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default apiRoute(async (req, matchedRoute) => {
    // TODO: Add checks for disabled or not email verified accounts

    const id = matchedRoute.params.id;

    // parse `Range` header
    const [start = 0, end = Number.POSITIVE_INFINITY] = (
        (req.headers.get("Range") || "")
            .split("=") // ["Range: bytes", "0-100"]
            .at(-1) || ""
    ) // "0-100"
        .split("-") // ["0", "100"]
        .map(Number); // [0, 100]

    // Serve file from filesystem
    const file = Bun.file(`./uploads/${id}`);

    const buffer = await file.arrayBuffer();

    if (!(await file.exists())) return errorResponse("File not found", 404);

    // Can't directly copy file into Response because this crashes Bun for now
    return new Response(buffer, {
        headers: {
            "Content-Type": file.type || "application/octet-stream",
            "Content-Length": `${file.size - start}`,
            "Content-Range": `bytes ${start}-${end}/${file.size}`,
        },
    });
});
