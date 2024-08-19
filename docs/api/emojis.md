# Emoji API

An Emoji API is made available to users to manage custom emoji on the instance. We recommend using Versia Server's CLI to manage emoji, but this API is available for those who prefer to use it (both admin and non-admin users).

## Create Emoji

```http
POST /api/v1/emojis
```

Creates a new custom emoji on the instance. If the user is an administrator, they can create global emoji that are visible to all users on the instance. Otherwise, the emoji will only be visible to the user who created it (in `/api/v1/custom_emojis`).

### Parameters

- `Content-Type`: `multipart/form-data`, `application/json` or `application/x-www-form-urlencoded`. If uploading a file, use `multipart/form-data`.

- `shortcode`: string, required. The shortcode for the emoji. Must be 2-64 characters long and contain only alphanumeric characters, dashes, and underscores.
- `element`: string or file, required. The image file for the emoji. This can be a URL or a file upload.
- `alt`: string, optional. The alt text for the emoji. Defaults to the shortcode.
- `global`: boolean, optional. For administrators only. Whether the emoji should be visible to all users on the instance. Defaults to `false`.
- `category`: string, optional. The category for the emoji. Maximum 64 characters.
  
### Response

```ts
// 200 OK
{
    id: string,
    shortcode: string,
    url: string,
    static_url: string,
    visible_in_picker: boolean,
    category: string | undefined,
}
```

## Get Emoji

```http
GET /api/v1/emojis/:id
```

Retrieves information about a custom emoji on the instance.

### Response

```ts
// 200 OK
{
    id: string,
    shortcode: string,
    url: string,
    static_url: string,
    visible_in_picker: boolean,
    category: string | undefined,
}
```

## Edit Emoji

```http
PATCH /api/v1/emojis/:id
```

Edits a custom emoji on the instance.

### Parameters

- `Content-Type`: `application/json`, `multipart/form-data` or `application/x-www-form-urlencoded`. If uploading a file, use `multipart/form-data`.

- `shortcode`: string, optional. The new shortcode for the emoji. Must be 2-64 characters long and contain only alphanumeric characters, dashes, and underscores.
- `element`: string or file, optional. The new image file for the emoji. This can be a URL or a file upload.
- `alt`: string, optional. The new alt text for the emoji. Defaults to the shortcode.
- `global`: boolean, optional. For administrators only. Whether the emoji should be visible to all users on the instance. Defaults to `false`.
- `category`: string, optional. The new category for the emoji. Maximum 64 characters.

### Response

```ts
// 200 OK
{
    id: string,
    shortcode: string,
    url: string,
    static_url: string,
    visible_in_picker: boolean,
    category: string | undefined,
}
```

## Delete Emoji

```http
DELETE /api/v1/emojis/:id
```

Deletes a custom emoji on the instance.