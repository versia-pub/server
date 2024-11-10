# SSO API

The SSO API is used to link, unlink, and list external OpenID Connect providers that the user has linked their account to.

## SSO Provider

```ts
interface SSOProvider {
    id: string;
    name: string;
    icon: string;
}
```

## SSO Link

```http
POST /api/v1/sso
```

Allows users to link their account to an external OpenID Connect provider.

- **Returns**: Link to redirect the user to the external provider.
- **Authentication**: Required
- **Permissions**: `oauth`
- **Version History**:
  - `0.6.0`: Added.
  - `0.7.0`: Permissions added.

### Request

- `issuer` (string, required): The issuer ID of the OpenID Connect provider as set in config.

#### Example

```http
POST /api/v1/sso
Authorization: Bearer ...
Content-Type: application/json

{
    "issuer": "google"
}
```

### Response

#### `200 OK`

Link to redirect the user to the external provider's page.

```json
{
    "link": "https://accounts.google.com/o/oauth2/auth?client_id=..."
}
```

## SSO Unlink

```http
DELETE /api/v1/sso/:issuer
```

Allows users to unlink their account from an external OpenID Connect provider.

- **Returns**: `204 No Content`
- **Authentication**: Required
- **Permissions**: `oauth`
- **Version History**:
  - `0.6.0`: Added.
  - `0.7.0`: Permissions added.

### Request

#### Example

```http
DELETE /api/v1/sso/google
Authorization: Bearer ...
```

### Response

#### `204 No Content`

Account successfully unlinked.

## List Connected Providers

```http
GET /api/v1/sso
```

Lists all external OpenID Connect providers that the user has linked their account to.

- **Returns**: Array of [`SSOProvider`](#ssoprovider) objects.
- **Authentication**: Required
- **Permissions**: `oauth`
- **Version History**:
  - `0.6.0`: Added.
  - `0.7.0`: Permissions added.

### Request

#### Example

```http
GET /api/v1/sso
Authorization: Bearer ...
```

### Response

#### `200 OK`

Array of [`SSOProvider`](#ssoprovider) objects.

```json
[
    {
        "id": "google",
        "name": "Google",
        "icon": "https://cdn.example.com/google.png"
    }
]
```

## Get Linked Provider Data

```http
GET /api/v1/sso/:issuer
```

Gets the data of an external OpenID Connect provider that the user has linked their account to.

- **Returns**: [`SSOProvider`](#ssoprovider) object.
- **Authentication**: Required
- **Permissions**: `oauth`
- **Version History**:
  - `0.6.0`: Added.
  - `0.7.0`: Permissions added.

### Request

#### Example

```http
GET /api/v1/sso/google
Authorization: Bearer ...
```

### Response

#### `200 OK`

[`SSOProvider`](#ssoprovider) object.

```json
{
    "id": "google",
    "name": "Google",
    "icon": "https://cdn.example.com/google.png"
}
```