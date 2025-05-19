# Mastodon API Extensions

Versia Server extends several Mastodon API endpoints to provide additional functionality. These endpoints are not part of the official Mastodon API, but are provided by Versia Server to enhance the user experience.

## Refetch User

```http
POST /api/v1/accounts/:id/refetch
```

Refetches the user's profile information from remote servers. Does not work for local users.

- **Returns**: [`Account`](https://docs.joinmastodon.org/entities/Account/)
- **Authentication**: Required
- **Permissions**: `read:account`
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
POST /api/v1/accounts/364fd13f-28b5-4e88-badd-ce3e533f0d02/refetch
Authorization: Bearer ...
```

### Response

#### `400 Bad Request`

The user is a local user and cannot be refetched.

#### `200 OK`

New user data.

Example from the [Mastodon API documentation](https://docs.joinmastodon.org/entities/Account/):

```json
{
    "id": "23634",
    "username": "noiob",
    "acct": "noiob@awoo.space",
    "display_name": "ikea shark fan account",
    "locked": false,
    "bot": false,
    "created_at": "2017-02-08T02:00:53.274Z",
    "note": "<p>:ms_rainbow_flag:​ :ms_bisexual_flagweb:​ :ms_nonbinary_flag:​ <a href=\"https://awoo.space/tags/awoo\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>awoo</span}.space <a href=\"https://awoo.space/tags/admin\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>admin</span} ~ <a href=\"https://awoo.space/tags/bi\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>bi</span} ~ <a href=\"https://awoo.space/tags/nonbinary\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>nonbinary</span} ~ compsci student ~ likes video <a href=\"https://awoo.space/tags/games\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>games</span} and weird/ old electronics and will post obsessively about both ~ avatar by <span class=\"h-card\"><a href=\"https://weirder.earth/@dzuk\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>dzuk</span}</span></p>",
    "url": "https://awoo.space/@noiob",
    "avatar": "https://files.mastodon.social/accounts/avatars/000/023/634/original/6ca8804dc46800ad.png",
    "avatar_static": "https://files.mastodon.social/accounts/avatars/000/023/634/original/6ca8804dc46800ad.png",
    "header": "https://files.mastodon.social/accounts/headers/000/023/634/original/256eb8d7ac40f49a.png",
    "header_static": "https://files.mastodon.social/accounts/headers/000/023/634/original/256eb8d7ac40f49a.png",
    "followers_count": 547,
    "following_count": 404,
    "statuses_count": 28468,
    "last_status_at": "2019-11-17",
    "emojis": [
        {
            "shortcode": "ms_rainbow_flag",
            "url": "https://files.mastodon.social/custom_emojis/images/000/028/691/original/6de008d6281f4f59.png",
            "static_url": "https://files.mastodon.social/custom_emojis/images/000/028/691/static/6de008d6281f4f59.png",
            "visible_in_picker": true
        },
        {
            "shortcode": "ms_bisexual_flag",
            "url": "https://files.mastodon.social/custom_emojis/images/000/050/744/original/02f94a5fca7eaf78.png",
            "static_url": "https://files.mastodon.social/custom_emojis/images/000/050/744/static/02f94a5fca7eaf78.png",
            "visible_in_picker": true
        },
        {
            "shortcode": "ms_nonbinary_flag",
            "url": "https://files.mastodon.social/custom_emojis/images/000/105/099/original/8106088bd4782072.png",
            "static_url": "https://files.mastodon.social/custom_emojis/images/000/105/099/static/8106088bd4782072.png",
            "visible_in_picker": true
        }
    ],
    "fields": [
        {
            "name": "Pronouns",
            "value": "they/them",
            "verified_at": null
        },
        {
            "name": "Alt",
            "value": "<span class=\"h-card\"><a href=\"https://cybre.space/@noiob\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>noiob</span}</span>",
            "verified_at": null
        },
        {
            "name": "Bots",
            "value": "<span class=\"h-card\"><a href=\"https://botsin.space/@darksouls\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>darksouls</span}</span>, <span class=\"h-card\"><a href=\"https://botsin.space/@nierautomata\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>nierautomata</span}</span>, <span class=\"h-card\"><a href=\"https://mastodon.social/@fedi\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>fedi</span}</span>, code for <span class=\"h-card\"><a href=\"https://botsin.space/@awoobot\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>awoobot</span}</span>",
            "verified_at": null
        },
        {
            "name": "Website",
            "value": "<a href=\"http://shork.xyz\" rel=\"nofollow noopener noreferrer\" target=\"_blank\"><span class=\"invisible\">http://</span><span class=\"\">shork.xyz</span><span class=\"invisible\"></span}",
            "verified_at": "2019-11-10T10:31:10.744+00:00"
        }
    ]
}
```

## Get User By Username

```http
GET /api/v1/accounts/id?username=:username
```

Retrieves a user by their username.

- **Returns**: [`Account`](https://docs.joinmastodon.org/entities/Account/)
- **Authentication**: Not required
- **Permissions**: `read:account`
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
GET /api/v1/accounts/id?username=bobleponge
```

### Response

#### `404 Not Found`

No user with that username was found.

#### `200 OK`

User data.

Example from the [Mastodon API documentation](https://docs.joinmastodon.org/entities/Account/):

```json
{
    "id": "23634",
    "username": "noiob",
    "acct": "noiob@awoo.space",
    "display_name": "ikea shark fan account",
    "locked": false,
    "bot": false,
    "created_at": "2017-02-08T02:00:53.274Z",
    "note": "<p>:ms_rainbow_flag:​ :ms_bisexual_flagweb:​ :ms_nonbinary_flag:​ <a href=\"https://awoo.space/tags/awoo\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>awoo</span}.space <a href=\"https://awoo.space/tags/admin\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>admin</span} ~ <a href=\"https://awoo.space/tags/bi\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>bi</span} ~ <a href=\"https://awoo.space/tags/nonbinary\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>nonbinary</span} ~ compsci student ~ likes video <a href=\"https://awoo.space/tags/games\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>games</span} and weird/ old electronics and will post obsessively about both ~ avatar by <span class=\"h-card\"><a href=\"https://weirder.earth/@dzuk\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>dzuk</span}</span></p>",
    "url": "https://awoo.space/@noiob",
    "avatar": "https://files.mastodon.social/accounts/avatars/000/023/634/original/6ca8804dc46800ad.png",
    "avatar_static": "https://files.mastodon.social/accounts/avatars/000/023/634/original/6ca8804dc46800ad.png",
    "header": "https://files.mastodon.social/accounts/headers/000/023/634/original/256eb8d7ac40f49a.png",
    "header_static": "https://files.mastodon.social/accounts/headers/000/023/634/original/256eb8d7ac40f49a.png",
    "followers_count": 547,
    "following_count": 404,
    "statuses_count": 28468,
    "last_status_at": "2019-11-17",
    "emojis": [
        {
            "shortcode": "ms_rainbow_flag",
            "url": "https://files.mastodon.social/custom_emojis/images/000/028/691/original/6de008d6281f4f59.png",
            "static_url": "https://files.mastodon.social/custom_emojis/images/000/028/691/static/6de008d6281f4f59.png",
            "visible_in_picker": true
        },
        {
            "shortcode": "ms_bisexual_flag",
            "url": "https://files.mastodon.social/custom_emojis/images/000/050/744/original/02f94a5fca7eaf78.png",
            "static_url": "https://files.mastodon.social/custom_emojis/images/000/050/744/static/02f94a5fca7eaf78.png",
            "visible_in_picker": true
        },
        {
            "shortcode": "ms_nonbinary_flag",
            "url": "https://files.mastodon.social/custom_emojis/images/000/105/099/original/8106088bd4782072.png",
            "static_url": "https://files.mastodon.social/custom_emojis/images/000/105/099/static/8106088bd4782072.png",
            "visible_in_picker": true
        }
    ],
    "fields": [
        {
            "name": "Pronouns",
            "value": "they/them",
            "verified_at": null
        },
        {
            "name": "Alt",
            "value": "<span class=\"h-card\"><a href=\"https://cybre.space/@noiob\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>noiob</span}</span>",
            "verified_at": null
        },
        {
            "name": "Bots",
            "value": "<span class=\"h-card\"><a href=\"https://botsin.space/@darksouls\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>darksouls</span}</span>, <span class=\"h-card\"><a href=\"https://botsin.space/@nierautomata\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>nierautomata</span}</span>, <span class=\"h-card\"><a href=\"https://mastodon.social/@fedi\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>fedi</span}</span>, code for <span class=\"h-card\"><a href=\"https://botsin.space/@awoobot\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>awoobot</span}</span>",
            "verified_at": null
        },
        {
            "name": "Website",
            "value": "<a href=\"http://shork.xyz\" rel=\"nofollow noopener noreferrer\" target=\"_blank\"><span class=\"invisible\">http://</span><span class=\"\">shork.xyz</span><span class=\"invisible\"></span}",
            "verified_at": "2019-11-10T10:31:10.744+00:00"
        }
    ]
}
```

## Get Instance TOS

```http
GET /api/v1/instance/tos
```

Returns the instance's Terms of Service, as configured in the instance settings.

- **Returns**: [`ExtendedDescription`](https://docs.joinmastodon.org/entities/ExtendedDescription/)
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
GET /api/v1/instance/tos
```

### Response

#### `200 OK`

Instance's Terms of Service.

```json
{
    "updated_at": "2019-11-17T00:00:00.000Z",
    "content": "<h1>TOS</h1>\n<p>These are the terms of service for this instance.</p>",
}
```

## Get Instance Privacy Policy

```http
GET /api/v1/instance/privacy_policy
```

Returns the instance's Privacy Policy, as configured in the instance settings.

- **Returns**: [`ExtendedDescription`](https://docs.joinmastodon.org/entities/ExtendedDescription/)
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
GET /api/v1/instance/privacy_policy
```

### Response

#### `200 OK`

Instance's Privacy Policy.

```json
{
    "updated_at": "2019-11-17T00:00:00.000Z",
    "content": "<h1>Privacy Policy</h1>\n<p>This is the privacy policy for this instance.</p>",
}
```

## `/api/v1/instance`

Extra attributes have been added to the `/api/v1/instance` endpoint.

```ts
interface SSOProvider {
    id: string;
    name: string;
    icon?: string;
}

type ExtendedInstance = Instance & {
    banner: string | null;
    versia_version: string;
    sso: {
        forced: boolean;
        providers: SSOProvider[];
    };
}
```

### `banner`

The URL of the instance's banner image.

### `versia_version`

The version of Versia Server running on the instance.

The normal `version` field is always set to `"4.3.0+glitch"` or similar, to not confuse clients that expect a Mastodon instance.

### `sso`

Single Sign-On (SSO) settings for the instance. This object contains two fields:

- `forced`: If this is enabled, normal identifier/password login is disabled and login must be done through SSO.
- `providers`: An array of external OpenID Connect providers that users can link their accounts to. Each provider object contains the following fields:
  - `id`: The issuer ID of the OpenID Connect provider.
  - `name`: The name of the provider.
  - `icon`: The URL of the provider's icon. Optional.

## `/api/v2/instance`

Extra attributes have been added to the `/api/v2/instance` endpoint. These are identical to the `/api/v1/instance` endpoint, except that the `banner` attribute uses the normal Mastodon API attribute.

```ts
type ExtendedInstanceV2 = InstanceV2 & {
    versia_version: string;
    configuration: Instance["configuration"] & {
        emojis: {
            // In bytes
            emoji_size_limit: number;
            max_emoji_shortcode_characters: number;
            max_emoji_description_characters: number;
        };
    };
    sso: {
        forced: boolean;
        providers: SSOProvider[];
    };
}
```

### `versia_version`

The version of Versia Server running on the instance.

The normal `version` field is always set to `"4.3.0+glitch"` or similar, to not confuse clients that expect a Mastodon instance.

### `sso`

Single Sign-On (SSO) settings for the instance. This object contains two fields:

- `forced`: If this is enabled, normal identifier/password login is disabled and login must be done through SSO.
- `providers`: An array of external OpenID Connect providers that users can link their accounts to. Each provider object contains the following fields:
  - `id`: The issuer ID of the OpenID Connect provider.
  - `name`: The name of the provider.
  - `icon`: The URL of the provider's icon. Optional.

## `Account`

Two extra attributes have been added to all returned [`Account`](https://docs.joinmastodon.org/entities/Account/) objects.

This object is returned on routes such as `/api/v1/accounts/:id`, `/api/v1/accounts/verify_credentials`, etc.

```ts
type ExtendedAccount = Account & {
    roles: Role[];
    uri: string;
}
```

### `roles`

An array of `Roles` that the user has.

### `uri`

URI of the account's Versia entity (for federation). Similar to Mastodon's `uri` field on notes.

## `Status`

One attribute has been added to all returned [`Status`](https://docs.joinmastodon.org/entities/Status/) objects.

This object is returned on routes such as `/api/v1/statuses/:id`, `/api/v1/statuses/:id/context`, etc.

```ts
type URL = string;

interface NoteReaction {
    name: string;
    count: number;
    me: boolean;
    url: URL;
}

type ExtendedStatus = Status & {
    reactions: NoteReaction[];
}
```

```json
{
    ...
    "reactions": [
        {
            "name": "like",
            "count": 3,
            "me": true,
        },
        {
            "name": "blobfox",
            "count": 1,
            "me": false,
        }
    ]
}
```

### `reactions`

An array of all the [`NoteReactions`](./reactions.md#reaction) for the note. Data for the custom emoji (e.g. URL) can be found in the `emojis` field of the [`Status`](https://docs.joinmastodon.org/entities/Status#emojis).

## `/api/v1/accounts/update_credentials`

The `username` parameter can now (optionally) be set to change the user's handle.

> [!WARNING]
> Clients should indicate to users that changing their handle will break existing links to their profile. This is reversible, but the old handle will be available for anyone to claim.
