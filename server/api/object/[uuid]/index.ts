import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/object/:id",
});

export default apiRoute(() => {
    return jsonResponse({});
});
