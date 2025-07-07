import { Account } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/verify_credentials",
        describeRoute({
            summary: "Verify account credentials",
            description: "Test to make sure that the user token works.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#verify_credentials",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    // TODO: Implement CredentialAccount
                    description:
                        "Note the extra source property, which is not visible on accounts other than your own. Also note that plain-text is used within source and HTML is used for their corresponding properties such as note and fields.",
                    content: {
                        "application/json": {
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
            scopes: ["read:accounts"],
        }),
        (context) => {
            // TODO: Add checks for disabled/unverified accounts
            const { user } = context.get("auth");

            return context.json(user.toApi(true), 200);
        },
    ),
);
