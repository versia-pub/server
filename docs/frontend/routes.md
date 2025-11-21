# Frontend Routes

Frontend implementors must implement these routes for correct operation of the instance.

The location of these routes can be configured in the Versia Server configuration at `frontend.routes`:

## Login Form

```http
GET /oauth/authorize
```

This route should display a login form for the user to enter their username and password, as well as a list of OpenID providers to use if available.

The form should submit to the OpenID Connect flow.

Configurable in the Versia Server configuration at `frontend.routes.login`.

## Consent Form

```http
GET /oauth/consent
```

This route should display a consent form for the user to approve the requested application permissions, after logging in.

The form should submit an OpenID Connect authorization request at `POST /oauth/authorize`, with the correct [application](https://docs.joinmastodon.org/entities/Application/) data (client ID, redirect URI, etc.). Do not forget the JWT cookie.

### Submission Example

```http
POST /oauth/authorize
Content-Type: application/json
Cookie: jwt=...

{
    "client_id": "client_id",
    "response_type": "code",
    "redirect_uri": "https://example.com/callback",
    "scope": "read write",
    "state": "state123",
    "code_challenge": "code_challenge",
    "code_challenge_method": "S256",
    "response_type": "code"
}
```

### Submission Response

```http
HTTP/2.0 302 Found
Location: https://example.com/callback?code=code&state=state123
```
