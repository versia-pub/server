# Emoji API

This API allows users to create, read, update, and delete instance custom emojis.

The **Versia Server CLI** can also be used to manage custom emojis.

## Emoji

```typescript
type UUID = string;
type URL = string;

interface Emoji {
    id: UUID;
    shortcode: string;
    url: URL;
    static_url?: URL;
    visible_in_picker: boolean;
    category?: string;
}
```

## Create Emoji

```http
POST /api/v1/emojis
```

Upload a new custom emoji.

- **Returns:** [`Emoji`](#emoji)
- **Authentication:** Required
- **Permissions:** `owner:emoji`, or `emoji` if uploading a global emoji.
- **Version History**:
  - `0.7.0`: Added.

### Request

- `shortcode` (string, required): The shortcode for the emoji.
  - 1-64 characters long, alphanumeric, and may contain dashes or underscores.
- `element` (file/string, required): The image file to upload.
  - Can be a URL, or a file upload (`multipart/form-data`).
- `alt` (string): Emoji alt text.
- `category` (string): Emoji category. Can be any string up to 64 characters long.
- `global` (boolean): If set to `true`, the emoji will be visible to all users, not just the uploader.
  - Requires `emoji` permission.

#### Example

```http
POST /api/v1/emojis
Content-Type: application/json
Authorization: Bearer ...

{
    "shortcode": "blobfox-coffee",
    "element": "https://example.com/blobfox-coffee.png",
    "alt": "My emoji",
    "category": "Blobmojis"
}
```

### Response

#### `201 Created`

Emoji successfully uploaded.

```json
{
    "id": "f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b",
    "shortcode": "blobfox-coffee",
    "url": "https://cdn.yourinstance.com/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b.png",
    "static_url": "https://cdn.yourinstance.com/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b.png",
    "visible_in_picker": true,
    "category": "Blobmojis"
}
```

## Get Emoji

```http
GET /api/v1/emojis/:id
```

Get a specific custom emoji.

- **Returns:** [`Emoji`](#emoji)
- **Authentication:** Required
- **Permissions:** `owner:emoji`, or `emoji` if viewing a global emoji.
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
GET /api/v1/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b
Authorization: Bearer ...
```

### Response

#### `200 OK`

Custom emoji data.

```json
{
    "id": "f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b",
    "shortcode": "blobfox-coffee",
    "url": "https://cdn.yourinstance.com/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b.png",
    "static_url": "https://cdn.yourinstance.com/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b.png",
    "visible_in_picker": true,
    "category": "Blobmojis"
}
```

## Edit Emoji

```http
PATCH /api/v1/emojis/:id
```

Edit an existing custom emoji.

- **Returns:** [`Emoji`](#emoji)
- **Authentication:** Required
- **Permissions:** `owner:emoji`, or `emoji` if editing a global emoji.
- **Version History**:
  - `0.7.0`: Added.

### Request

> [!NOTE]
> All fields are optional.

- `shortcode` (string): The shortcode for the emoji.
  - 1-64 characters long, alphanumeric, and may contain dashes or underscores.
- `element` (file/string): The image file to upload.
  - Can be a URL, or a file upload (`multipart/form-data`).
- `alt` (string): Emoji alt text.
- `category` (string): Emoji category. Can be any string up to 64 characters long.
- `global` (boolean): If set to `true`, the emoji will be visible to all users, not just the uploader.
  - Requires `emoji` permission.

#### Example

```http
PATCH /api/v1/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b
Content-Type: application/json
Authorization: Bearer ...

{
    "category": "Blobfoxes"
}
```

### Response

#### `200 OK`

Emoji successfully edited.

```json
{
    "id": "f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b",
    "shortcode": "blobfox-coffee",
    "url": "https://cdn.yourinstance.com/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b.png",
    "static_url": "https://cdn.yourinstance.com/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1b1b.png",
    "visible_in_picker": true,
    "category": "Blobfoxes"
}
```

## Delete Emoji

```http
DELETE /api/v1/emojis/:id
```

Delete an existing custom emoji.

- **Returns:** `204 No Content`
- **Authentication:** Required
- **Permissions:** `owner:emoji`, or `emoji` if deleting a global emoji.
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
DELETE /api/v1/emojis/f7b1c1b0-0b1b-4b1b-8b1b-0b1b1b1b1
Authorization: Bearer ...
```

### Response

#### `204 No Content`

Emoji successfully deleted.