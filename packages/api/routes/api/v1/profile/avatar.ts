import { Account, RolePermission } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.delete(
        "/api/v1/profile/avatar",
        describeRoute({
            summary: "Delete profile avatar",
            description:
                "Deletes the avatar associated with the user’s profile.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/profile/#delete-profile-avatar",
            },
            tags: ["Profile"],
            responses: {
                200: {
                    description:
                        "The avatar was successfully deleted from the user’s profile. If there were no avatar associated with the profile, the response will still indicate a successful deletion.",
                    content: {
                        "application/json": {
                            // TODO: Return a CredentialAccount
                            schema: resolver(Account),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnAccount],
            scopes: ["write:account"],
        }),
        async (context) => {
            const { user } = context.get("auth");

            await user.avatar?.delete();
            await user.reload();

            return context.json(user.toApi(true), 200);
        },
    ),
);
