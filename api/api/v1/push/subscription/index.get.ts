import { apiRoute } from "@/api";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import { route } from "./index.get.schema";

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { token } = context.get("auth");

        const ps = await PushSubscription.fromToken(token);

        if (!ps) {
            throw new ApiError(
                404,
                "No push subscription associated with this access token",
            );
        }

        return context.json(ps.toApi(), 200);
    }),
);
