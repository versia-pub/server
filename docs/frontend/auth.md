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

## Sign In

```http
POST /api/auth/login
```

Allows users to sign in to the instance. This is the first step in the authentication process.

- **Returns**: `302 Found` with a `Location` header to redirect the user to the next step, as well as a `Set-Cookie` header with the session JWT.
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: First documented.

### Request

- `identifier` (string, required): The username or email of the user. Case-insensitive.
- `password` (string, required): The password of the user.

#### Query Parameters

- `client_id` (string, required): Client ID of the [application](https://docs.joinmastodon.org/entities/Application/) that is making the request.
- `redirect_uri` (string, required): Redirect URI of the [application](https://docs.joinmastodon.org/entities/Application/) that is making the request. Must match the saved value.
- `response_type` (string, required): Must be `code`.
- `scope` (string, required): OAuth2 scopes. Must match the value indicated in the [application](https://docs.joinmastodon.org/entities/Application/).

#### Example

```http
POST /api/auth/login?client_id=123&redirect_uri=https%3A%2F%2Fexample.com%2Fauth&response_type=code&scope=read%20write
Content-Type: application/json

{
    "identifier": "bobjones@gmail.com",
    "password": "hunter2"
}
```

### Response

#### `302 Found`

Redirects the user to the consent page with some query parameters. The frontend should redirect the user to this URL.

This response also has a `Set-Cookie` header with a [JSON Web Token](https://jwt.io/) that contains the user's session information. This JWT is signed with the instance's secret key, and must be included in all subsequent authentication requests.

```http
HTTP/2.0 302 Found
Location: /oauth/consent?client_id=123&redirect_uri=https%3A%2F%2Fexample.com%2Fauth&response_type=code&scope=read%20write
Set-Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
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