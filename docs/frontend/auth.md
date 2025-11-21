# Frontend Authentication

Multiple API routes are exposed for authentication, to be used by frontend developers.

> [!INFO]
>
> These are different from the Client API routes, which are used by clients to interact with the Mastodon API.

A frontend is a web application that is designed to be the primary user interface for an instance. It is used also used by clients to perform authentication.

## Get Frontend Configuration

```http
GET /api/v1/frontend/config
```

Retrieves the frontend configuration for the instance. This returns whatever the `frontend.settings` object is set to in the Versia Server configuration.

This behaves like the `/api/v1/preferences` endpoint in the Mastodon API, but is specific to the frontend. These values are arbitrary and can be used for anything.

Frontend developers should always namespace their keys to avoid conflicts with other keys.

- **Returns**: Object with arbitrary keys and values.
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
GET /api/v1/frontend/config
```

### Response

#### `200 OK`

Frontend configuration.

```json
{
    "pub.versia.fe:theme": "dark",
    "pub.versia.fe:custom_css": "body { background-color: black; }",
    "net.googly.frontend:spoiler_image": "https://example.com/spoiler.png"
}
```

## SSO Sign In

```http
POST /oauth/sso
```

Allows users to sign in to the instance using an external OpenID Connect provider.

- **Returns**: `302 Found` with a `Location` header to redirect the user to the next step.
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: First documented.

### Request

#### Query Parameters

- `client_id` (string, required): Client ID of the [application](https://docs.joinmastodon.org/entities/Application/) that is making the request.
- `issuer` (string, required): The ID of the OpenID Connect provider, as found in `/api/{v1,v2}/instance`.

#### Example

```http
POST /oauth/sso?client_id=123&issuer=google
```

### Response

#### `302 Found`

Redirects the user to the OpenID Connect provider's login page.

```http
HTTP/2.0 302 Found
Location: https://accounts.google.com/o/oauth2/auth?client_id=123&redirect_uri=https%3A%2F%2Fexample.com%2Fauth&response_type=code&scope=openid%20email&state=123
```
