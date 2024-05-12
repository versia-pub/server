# Emoji API

An Emoji API is made available to administrators to manage custom emoji on the instance. We recommend using Lysand's CLI to manage emoji, but this API is available for those who prefer to use it.

## Create Emoji

```http
POST /api/v1/emojis
```

Creates a new custom emoji on the instance.

### Parameters

- `Content-Type`: `multipart/form-data`, `application/json` or `application/x-www-form-urlencoded`. If uploading a file, use `multipart/form-data`.

- `shortcode`: string, required. The shortcode for the emoji. Must be 2-64 characters long and contain only alphanumeric characters, dashes, and underscores.
- `element`: string or file, required. The image file for the emoji. This can be a URL or a file upload.
- `alt`: string, optional. The alt text for the emoji. Defaults to the shortcode.

### Response

```ts
// 200 OK
{
    id: string,
    shortcode: string,
    url: string,
    static_url: string,
    visible_in_picker: boolean,
    // Lysand does not have a category system for emoji yet, so this is always undefined.
    category: undefined,
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
    category: undefined,
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

### Response

```ts
// 200 OK
{
    id: string,
    shortcode: string,
    url: string,
    static_url: string,
    visible_in_picker: boolean,
    category: undefined,
}
```

## Delete Emoji

```http
DELETE /api/v1/emojis/:id
```

Deletes a custom emoji on the instance.