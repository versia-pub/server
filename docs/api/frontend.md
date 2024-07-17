# Frontend API

The frontend API contains endpoints that are useful for frontend developers. These endpoints are not part of the Mastodon API, but are specific to Lysand.

## Routes that the Frontend must implement

These routes can be set to a different URL in the Lysand configuration, at `frontend.routes`. The frontend must implement these routes for the instance to function correctly.

- `GET /oauth/authorize`: (NOT `POST`): Identifier/password login form, submits to [`POST /api/auth/login`](#sign-in) or OpenID Connect flow.
- `GET /oauth/consent`: Consent form, submits to [`POST /api/auth/redirect`](#consent)

## Get Frontend Configuration

```http
GET /api/v1/frontend/config
```

Retrieves the frontend configuration for the instance. This returns whatever the `frontend.settings` object is set to in the Lysand configuration.

This behaves like the `/api/v1/preferences` endpoint in the Mastodon API, but is specific to the frontend. These values are arbitrary and can be used for anything.

For example, the frontend configuration could contain the following:

```json
{
    "org.lysand.fe:theme": "dark",
    "org.lysand.fe:custom_css": "body { background-color: black; }",
    // Googly is an imaginary frontend that uses the `net.googly.frontend` namespace
    "net.googly.frontend:spoiler_image": "https://example.com/spoiler.png"
}
```

Frontend developers should always namespace their keys to avoid conflicts with other keys.

### Response

```ts
// 200 OK
{
    [key: string]: any;
}
```

## Sign In

Allows users to sign in to the instance. Required for the frontend to function.

```http
POST /api/auth/login
```

### Parameters

- `Content-Type`: `multipart/form-data`

- `identifier`: string, required. Either the username or the email of the user. Converted to lowercase automatically (case insensitive).
- `password`: string, required. The password of the user.

#### Query Parameters

- `client_id`: string, required. Client ID of the Mastodon API application that is making the request.
- `redirect_uri`: string, required. Redirect URI of the Mastodon API application that is making the request. Must match the saved value.
- `response_type`: string, required. Must be `code`.
- `scope`: string, required. Standard Mastodon API OAuth2 scope. Must match the saved value.

### Response

Responds with a `302 Found` redirect to `/oauth/consent` with some query parameters. The frontend should redirect the user to this URL.

This response also has a `Set-Cookie` header with a [JSON Web Token](https://jwt.io/) that contains the user's session information. This JWT is signed with the instance's secret key, and must be included in all subsequent authentication requests.

## Redirect

Redirects the user from the consent page to the redirect URI with the authorization code.

```http
POST /api/auth/redirect
```

### Query Parameters

- `client_id`: string, required. Client ID of the Mastodon API application that is making the request.
- `redirect_uri`: string, required. Redirect URI of the Mastodon API application that is making the request. Must match the saved value.
- `code`: string, required. Authorization code from the previous step.

### Response

Responds with a `302 Found` redirect to the `redirect_uri` with the authorization code as a query parameter.

## SSO Login

Allows users to sign in to the instance using an external OpenID Connect provider.

```http
POST /oauth/sso
```

### Query Parameters

- `issuer`: string, required. The issuer ID of the OpenID Connect provider as set in config.
- `client_id`: string, required. Client ID of the Mastodon API application that is making the request.

### Response

Responds with a `302 Found` redirect to the OpenID Connect provider's authorization endpoint. The frontend should redirect the user to this URL, without modification.

## SSO Callback/Redirect

> [!INFO]
> This endpoint should not be called directly by the frontend. It is an internal route.

Callback URL for the OpenID Connect provider to redirect to after the user has authenticated.

```http
GET /oauth/sso/:issuer/callback
```

### Query Parameters

- `client_id`: string, required. Client ID of the Mastodon API application that is making the request.
- `flow_id`: string, required. Flow ID of the OpenID Connect flow.
- `link`: boolean, optional. If `true`, the user is linking their account to the OpenID Connect provider.
- `user_id`: string, optional. User ID of the user that is linking their account. Required if `link` is `true`.

### Response

Responds with a `302 Found` redirect to either `/oauth/consent` or `/?oidc_account_linked=true` if the user is linking their account.

When erroring, responds with a `302 Found` redirect to `/?oidc_account_linking_error=<error_message>&oidc_account_linking_error_message=<error_description>`.

## SSO Link

Allows users to link their account to an external OpenID Connect provider.

```http
POST /api/v1/sso
```

### Parameters

This request is authenticated with the user's Mastodon API access token.

- `Content-Type`: `application/json`, `application/x-www-form-urlencoded` or `multipart/form-data`.

- `issuer`: string, required. The issuer ID of the OpenID Connect provider as set in config.

### Response

The client must redirect the user to the contents of the `link` field in the response.

```ts
// 200 OK
{
    link: string;
}
```

## SSO Unlink

Allows users to unlink their account from an external OpenID Connect provider.

```http
DELETE /api/v1/sso/:issuer
```

### Parameters

This request is authenticated with the user's Mastodon API access token.

### Response

```ts
// 204 NO CONTENT
```

## SSO List

Lists all external OpenID Connect providers that the user has linked their account to.

```http
GET /api/v1/sso
```

### Parameters

This request is authenticated with the user's Mastodon API access token.

### Response

```ts
// 200 OK
{
    id: string;
    name: string;
    icon: string;
}[];
```

## SSO Get Linked Provider Data

Gets the data of an external OpenID Connect provider that the user has linked their account to. The same data is returned as in the `/api/v1/sso` endpoint.

```http
GET /api/v1/sso/:issuer
```

### Parameters

This request is authenticated with the user's Mastodon API access token.

### Response

```ts
// 200 OK
{
    id: string;
    name: string;
    icon: string;
}
```

## Get User By Username

Gets a user by their username.

```http
GET /api/v1/users/id?username=myCoolUser
```

### Response

Returns an account object.

```ts
// 200 OK
{
    id: string;
    // Account object
}