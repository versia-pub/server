import type { Context, TypedResponse } from "hono";

export const errors = {
    InvalidJWT: ["invalid_request", "Invalid JWT: could not verify"],
    MissingJWTFields: [
        "invalid_request",
        "Invalid JWT: missing required fields (aud, sub, exp, iss)",
    ],
    InvalidSub: ["invalid_request", "Invalid JWT: sub is not a valid user ID"],
    UserNotFound: [
        "invalid_request",
        "Invalid JWT, could not find associated user",
    ],
    MissingOauthPermission: [
        "unauthorized",
        "User missing required 'oauth' permission",
    ],
    MissingApplication: [
        "invalid_request",
        "Invalid client_id: no associated API application found",
    ],
    InvalidRedirectUri: [
        "invalid_request",
        "Invalid redirect_uri: does not match API application's redirect_uri",
    ],
    InvalidScope: [
        "invalid_request",
        "Invalid scope: not a subset of the application's scopes",
    ],
};

export const errorRedirect = (
    context: Context,
    error: (typeof errors)[keyof typeof errors],
    extraParams?: URLSearchParams,
): Response & TypedResponse<undefined, 302, "redirect"> => {
    const errorSearchParams = new URLSearchParams(extraParams);

    errorSearchParams.append("error", error[0]);
    errorSearchParams.append("error_description", error[1]);

    return context.redirect(
        `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
    );
};
