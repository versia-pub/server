# Reactions API

This API is used to send reactions to notes.

## Reaction

```typescript
type UUID = string;

interface NoteReaction {
    name: string;
    count: number;
    me: boolean;
}

type NoteReactionWithAccounts = NoteReaction & {
    account_ids: UUID[];
}
```

## Get Reactions

All reactions attached to a [`Status`](https://docs.joinmastodon.org/entities/Status) can be found on the note itself, [in the `reactions` field](./mastodon.md#reactions).

## Get Users Who Reacted

```http
GET /api/v1/statuses/:id/reactions
```

Get a list of all the users who reacted to a note. Only IDs are returned, not full account objects, to improve performance on very popular notes.

- **Returns:** [`NoteReactionWithAccounts[]`](#reaction)
- **Authentication:** Not required
- **Permissions:** `read:reaction`
- **Version History**:
  - `0.8.0`: Added.

### Request

#### Example

```http
GET /api/v1/statuses/123/reactions
```

### Response

#### `200 OK`

List of reactions and associated users. The `me` field is `true` if the current user has reacted with that emoji.

Data for the custom emoji (e.g. URL) can be found in the `emojis` field of the [`Status`](https://docs.joinmastodon.org/entities/Status#emojis).

```json
[
    {
        "name": "like",
        "count": 3,
        "me": true,
        "account_ids": ["1", "2", "3"]
    },
    {
        "name": "blobfox-coffee",
        "count": 1,
        "me": false,
        "account_ids": ["4"]
    }
]
```

## Add Reaction

```http
PUT /api/v1/statuses/:id/reactions/:name
```

Add a reaction to a note.

- **Returns:** [`Status`](https://docs.joinmastodon.org/entities/Status)
- **Authentication:** Required
- **Permissions:** `owner:reaction`
- **Version History**:
  - `0.8.0`: Added.

### Request

- `name` (string, required): Either a custom emoji shortcode or a Unicode emoji.

#### Example

```http
PUT /api/v1/statuses/123/reactions/blobfox-coffee
Authorization: Bearer ...
```

```http
PUT /api/v1/statuses/123/reactions/👍
Authorization: Bearer ...
```

### Response

#### `201 Created`

Returns the updated note.

```json
{
    "id": "123",
    ...
    "reactions": [
        {
            "name": "👍",
            "count": 3,
            "me": true
        },
        {
            "name": "blobfox-coffee",
            "count": 1,
            "me": false
        }
    ]
}
```

## Remove Reaction

```http
DELETE /api/v1/statuses/:id/reactions/:name
```

Remove a reaction from a note.

- **Returns:** [`Status`](https://docs.joinmastodon.org/entities/Status)
- **Authentication:** Required
- **Permissions:** `owner:reaction`
- **Version History**:
  - `0.8.0`: Added.

### Request

- `name` (string, required): Either a custom emoji shortcode or a Unicode emoji.

#### Example

```http
DELETE /api/v1/statuses/123/reactions/blobfox-coffee
Authorization: Bearer ...
```

```http
DELETE /api/v1/statuses/123/reactions
Authorization: Bearer ...
```

### Response

#### `200 OK`

Returns the updated note. If the reaction was not found, the note is returned as is.

```json
{
    "id": "123",
    ...
    "reactions": [
        {
            "name": "👍",
            "count": 3,
            "me": true
        }
    ]
}
```
