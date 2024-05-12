# Moderation API

> [!WARNING]
> **NOT IMPLEMENTED**

The Lysand project uses the Mastodon API to interact with clients. However, the moderation API is custom-made for Lysand Server, as it allows for more fine-grained control over the server's behavior.

## Flags, ModTags and ModNotes

Flags are used by Lysand Server to automatically attribute tags to a status or account based on rules. ModTags and ModNotes are used by moderators to manually tag and take notes on statuses and accounts.

The difference between flags and modtags is that flags are automatically attributed by the server, while modtags are manually attributed by moderators.

### Flag Types

- `content_filter`: (Statuses only) The status contains content that was filtered by the server's content filter.
- `bio_filter`: (Accounts only) The account's bio contains content that was filtered by the server's content filter.
- `emoji_filter`: The status or account contains an emoji that was filtered by the server's content filter.
- `reported`: The status or account was previously reported by a user.
- `suspended`: The status or account was previously suspended by a moderator.
- `silenced`: The status or account was previously silenced by a moderator.

### ModTag Types

ModTag do not have set types and can be anything. Lysand Server autosuggest previously used tags when a moderator is adding a new tag to avoid duplicates.

### Data Format

```ts
type Flag = {
  id: string,
  // One of the following two fields will be present
  flaggedStatus?: Status,
  flaggedUser?: User,
  flagType: string,
  createdAt: string,
}

type ModTag = {
  id: string,
  // One of the following two fields will be present
  taggedStatus?: Status,
  taggedUser?: User,
  mod: User,
  tag: string,
  createdAt: string,
}

type ModNote = {
  id: string,
  // One of the following two fields will be present
  notedStatus?: Status,
  notedUser?: User,
  mod: User,
  note: string,
  createdAt: string,
}
```

The `User` and `Status` types are the same as the ones in the Mastodon API.

## Moderation API Routes

### `GET /api/v1/moderation/accounts/:id`

Returns full moderation data and flags for the account with the given ID.

Output format:

```ts
{
  id: string, // Same ID as in account field
  flags: Flag[],
  modtags: ModTag[],
  modnotes: ModNote[],
  account: User,
}
```

### `GET /api/v1/moderation/statuses/:id`

Returns full moderation data and flags for the status with the given ID.

Output format:

```ts
{
  id: string, // Same ID as in status field
  flags: Flag[],
  modtags: ModTag[],
  modnotes: ModNote[],
  status: Status,
}
```

### `POST /api/v1/moderation/accounts/:id/modtags`

Params:
- `tag`: string

Adds a modtag to the account with the given ID

### `POST /api/v1/moderation/statuses/:id/modtags`

Params:
- `tag`: string

Adds a modtag to the status with the given ID

### `POST /api/v1/moderation/accounts/:id/modnotes`

Params:
- `note`: string

Adds a modnote to the account with the given ID

### `POST /api/v1/moderation/statuses/:id/modnotes`

Params:
- `note`: string

Adds a modnote to the status with the given ID

### `DELETE /api/v1/moderation/accounts/:id/modtags/:modtag_id`

Deletes the modtag with the given ID from the account with the given ID

### `DELETE /api/v1/moderation/statuses/:id/modtags/:modtag_id`

Deletes the modtag with the given ID from the status with the given ID

### `DELETE /api/v1/moderation/accounts/:id/modnotes/:modnote_id`

Deletes the modnote with the given ID from the account with the given ID

### `DELETE /api/v1/moderation/statuses/:id/modnotes/:modnote_id`

Deletes the modnote with the given ID from the status with the given ID

### `GET /api/v1/moderation/modtags`

Returns a list of all modtags previously used by moderators

Output format:

```ts
{
  tags: string[],
}
```

### `GET /api/v1/moderation/accounts/flags/search`

Allows moderators to search for accounts based on their flags, this can also include status flags

Params:
- `limit`: Number
- `min_id`: String. Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.
- `max_id`: String. All results returned will be lesser than this ID. In effect, sets an upper bound on results.
- `since_id`: String. All results returned will be greater than this ID. In effect, sets a lower bound on results.
- `flags`: String (optional). Comma-separated list of flag types to filter by. Can be left out to return accounts with at least one flag
- `flag_count`: Number (optional). Minimum number of flags to filter by
- `include_statuses`: Boolean (optional). If true, includes status flags in the search results
- `account_id`: Array of strings (optional). Filters accounts by account ID

This method returns a `Link` header the same way Mastodon does, to allow for pagination.

Output format:

```ts
{
  accounts: {
    account: User,
    modnotes: ModNote[],
    flags: Flag[],
    statuses?: {
        status: Status,
        modnotes: ModNote[],
        flags: Flag[],
    }[],
  }[],
}
```

### `GET /api/v1/moderation/statuses/flags/search`

Allows moderators to search for statuses based on their flags

Params:
- `limit`: Number
- `min_id`: String. Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.
- `max_id`: String. All results returned will be lesser than this ID. In effect, sets an upper bound on results.
- `since_id`: String. All results returned will be greater than this ID. In effect, sets a lower bound on results.
- `flags`: String (optional). Comma-separated list of flag types to filter by. Can be left out to return statuses with at least one flag
- `flag_count`: Number (optional). Minimum number of flags to filter by
- `account_id`: Array of strings (optional). Filters statuses by account ID

This method returns a `Link` header the same way Mastodon does, to allow for pagination.

Output format:

```ts
{
  statuses: {
    status: Status,
    modnotes: ModNote[],
    flags: Flag[],
  }[],
}
```

### `GET /api/v1/moderation/accounts/modtags/search`

Allows moderators to search for accounts based on their modtags

Params:
- `limit`: Number
- `min_id`: String. Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.
- `max_id`: String. All results returned will be lesser than this ID. In effect, sets an upper bound on results.
- `since_id`: String. All results returned will be greater than this ID. In effect, sets a lower bound on results.
- `tags`: String (optional). Comma-separated list of tags to filter by. Can be left out to return accounts with at least one tag
- `tag_count`: Number (optional). Minimum number of tags to filter by
- `include_statuses`: Boolean (optional). If true, includes status tags in the search results
- `account_id`: Array of strings (optional). Filters accounts by account ID

This method returns a `Link` header the same way Mastodon does, to allow for pagination.

Output format:

```ts
{
  accounts: {
    account: User,
    modnotes: ModNote[],
    modtags: ModTag[],
    statuses?: {
        status: Status,
        modnotes: ModNote[],
        modtags: ModTag[],
    }[],
  }[],
}
```

### `GET /api/v1/moderation/statuses/modtags/search`

Allows moderators to search for statuses based on their modtags

Params:
- `limit`: Number
- `min_id`: String. Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.
- `max_id`: String. All results returned will be lesser than this ID. In effect, sets an upper bound on results.
- `since_id`: String. All results returned will be greater than this ID. In effect, sets a lower bound on results.
- `tags`: String (optional). Comma-separated list of tags to filter by. Can be left out to return statuses with at least one tag
- `tag_count`: Number (optional). Minimum number of tags to filter by
- `account_id`: Array of strings (optional). Filters statuses by account ID
- `include_statuses`: Boolean (optional). If true, includes status tags in the search results

This method returns a `Link` header the same way Mastodon does, to allow for pagination.

Output format:

```ts
{
  statuses: {
    status: Status,
    modnotes: ModNote[],
    modtags: ModTag[],
  }[],
}
```
