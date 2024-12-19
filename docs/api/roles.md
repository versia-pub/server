# Roles API

This API allows users to create, read, update, delete and assign instance custom roles. Custom roles can be used to grant users specific permissions, such as managing the instance, uploading custom emojis, or moderating content.

## Priorities

Every role has a "priority" value, which determines the order in which roles are applied. Roles with higher priorities take precedence over roles with lower priorities. The default priority is `0`.

Additionally, users cannot edit roles with a higher priority than their highest priority role.

## Visibility

Roles can be visible or invisible. Invisible roles are not shown to users in the UI, but they can still be managed via the API. This is useful for cosmetic roles that do not grant any permissions, e.g. `#1 Most Prominent Glizzy Eater`.

## Permissions

Default permissions for anonymous users, logged-in users, and administrators can be set in the configuration. These permissions are always applied in addition to the permissions granted by roles. You may set them to empty arrays to exclusively use roles for permissions (make sure your roles are set up correctly).

### List of Permissions

- `Manage` permissions grant the ability to create, read, update, and delete resources.
- `View` permissions grant the ability to read resources.
- `Owner` permissions grant the ability to manage resources that the user owns.

```ts
ManageNotes: "notes",
ManageOwnNotes: "owner:note",
ViewNotes: "read:note",
ViewNoteLikes: "read:note_likes",
ViewNoteBoosts: "read:note_boosts",
ManageAccounts: "accounts",
ManageOwnAccount: "owner:account",
ViewAccountFollows: "read:account_follows",
ManageLikes: "likes",
ManageOwnLikes: "owner:like",
ManageBoosts: "boosts",
ManageOwnBoosts: "owner:boost",
ViewAccounts: "read:account",
ManageEmojis: "emojis",
ViewEmojis: "read:emoji",
ManageOwnEmojis: "owner:emoji",
ViewReactions: "read:reaction",
ManageReactions: "reactions",
ManageOwnReactions: "owner:reaction",
ManageMedia: "media",
ManageOwnMedia: "owner:media",
ManageBlocks: "blocks",
ManageOwnBlocks: "owner:block",
ManageFilters: "filters",
ManageOwnFilters: "owner:filter",
ManageMutes: "mutes",
ManageOwnMutes: "owner:mute",
ManageReports: "reports",
ManageOwnReports: "owner:report",
ManageSettings: "settings",
ManageOwnSettings: "owner:settings",
ManageRoles: "roles",
ManageNotifications: "notifications",
ManageOwnNotifications: "owner:notification",
ManageFollows: "follows",
ManageOwnFollows: "owner:follow",
ManageOwnApps: "owner:app",
Search: "search",
ViewPublicTimelines: "public_timelines",
ViewPrimateTimelines: "private_timelines",
IgnoreRateLimits: "ignore_rate_limits",
Impersonate: "impersonate",
ManageInstance: "instance",
ManageInstanceFederation: "instance:federation",
ManageInstanceSettings: "instance:settings",
/** Users who do not have this permission will not be able to login! */
OAuth: "oauth",
```

An example usage of these permissions would be to not give the `ViewPublicTimelines` permission to anonymous users, but give it to logged-in users, in order to restrict access to public timelines.

### Manage Roles

The `roles` permission allows the user to manage roles, including adding and removing roles from themselves. This permission is required to use the Roles API.

### Impersonate

The `impersonate` permission allows the user to impersonate other users (logging in with their credentials). This is a dangerous permission and should be used with caution.

Useful for administrators who need to troubleshoot user issues.

### OAuth

The `oauth` permission is required for users to log in via OAuth. Users who do not have this permission will not be able to log in via OAuth.

## Role

```ts
type UUID = string;
type URL = string;
type Permission = string;

interface Role {
    id: UUID;
    name: string;
    permissions: Permission[];
    priority: number;
    description?: string | null;
    visible: boolean;
    icon?: URL | null;
}
```

## Get All Roles

```http
GET /api/v1/roles
```

Get a list of all roles on the instance.

- **Returns**: Array of [`Role`](#role)
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: Added.
  - `0.8.0`: Now returns all instance roles.

### Request

#### Example

```http
GET /api/v1/roles
Authorization: Bearer ...
```

### Response

#### `200 OK`

All roles on the instance.

```json
[
    {
        "id": "default",
        "name": "Default",
        "permissions": [
            "owner:note",
            "read:note",
            "read:note_likes",
            "read:note_boosts",
            "owner:account",
            "read:account_follows",
            "owner:like",
            "owner:boost",
            "read:account",
            "owner:emoji",
            "read:emoji",
            "owner:media",
            "owner:block",
            "owner:filter",
            "owner:mute",
            "owner:report",
            "owner:settings",
            "owner:notification",
            "owner:follow",
            "owner:app",
            "search",
            "public_timelines",
            "private_timelines",
            "oauth"
        ],
        "priority": 0,
        "description": "Default role for all users",
        "visible": false,
        "icon": null
    },
    {
        "id": "admin",
        "name": "Admin",
        "permissions": [
            "owner:note",
            "read:note",
            "read:note_likes",
            "read:note_boosts",
            "owner:account",
            "read:account_follows",
            "owner:like",
            "owner:boost",
            "read:account",
            "owner:emoji",
            "read:emoji",
            "owner:media",
            "owner:block",
            "owner:filter",
            "owner:mute",
            "owner:report",
            "owner:settings",
            "owner:notification",
            "owner:follow",
            "owner:app",
            "search",
            "public_timelines",
            "private_timelines",
            "oauth",
            "notes",
            "accounts",
            "likes",
            "boosts",
            "emojis",
            "media",
            "blocks",
            "filters",
            "mutes",
            "reports",
            "settings",
            "roles",
            "notifications",
            "follows",
            "impersonate",
            "ignore_rate_limits",
            "instance",
            "instance:federation",
            "instance:settings"
        ],
        "priority": 2147483647,
        "description": "Default role for all administrators",
        "visible": false,
        "icon": null
    }
]
```

## Get Role

```http
GET /api/v1/roles/:id
```

Get a specific role's data.

- **Returns**: [`Role`](#role)
- **Authentication**: Required
- **Permissions**: None
- **Version History**:
  - `0.7.0`: Added.

### Request

#### Example

```http
GET /api/v1/roles/default
Authorization: Bearer ...
```

### Response

#### `200 OK`

Role data.

```json
{
    "id": "default",
    "name": "Default",
    "permissions": [
        "owner:note",
        "read:note",
        "read:note_likes",
        "read:note_boosts",
        "owner:account",
        "read:account_follows",
        "owner:like",
        "owner:boost",
        "read:account",
        "owner:emoji",
        "read:emoji",
        "owner:media",
        "owner:block",
        "owner:filter",
        "owner:mute",
        "owner:report",
        "owner:settings",
        "owner:notification",
        "owner:follow",
        "owner:app",
        "search",
        "public_timelines",
        "private_timelines",
        "oauth"
    ],
    "priority": 0,
    "description": "Default role for all users",
    "visible": false,
    "icon": null
}
```

## Create Role

```http
POST /api/v1/roles
```

Create a new role.

- **Returns**: [`Role`](#role)
- **Authentication**: Required
- **Permissions**: `roles`
- **Version History**:
  - `0.8.0`: Added.

### Request

- `name` (string, required): The name of the role.
  - 1-128 characters.
- `permissions` (array of strings, optional): The permissions granted by the role. Defaults to an empty array.
- `priority` (number, optional): The priority of the role. Defaults to `0`.
- `description` (string, optional): A description of the role.
- `visible` (boolean, optional): Whether the role is visible in the UI. Defaults to `false`.
- `icon` (string, optional): An icon URL for the role.

#### Example

```http
POST /api/v1/roles
Authorization: Bearer ...
Content-Type: application/json

{
    "name": "Moderator",
    "permissions": [
        "notes",
        "accounts",
        "likes",
        "boosts",
        "emojis",
        "media",
        "blocks",
        "filters",
        "mutes",
        "reports",
        "settings",
        "roles",
        "notifications",
        "follows",
        "impersonate",
        "ignore_rate_limits",
        "instance",
        "instance:federation",
        "instance:settings"
    ],
    "priority": 100,
    "description": "Moderator role for managing content",
    "visible": true,
    "icon": "https://example.com/moderator.png"
}
```

### Response

#### `201 Created`

Role successfully created.

```json
{
    "id": "364fd13f-28b5-4e88-badd-ce3e533f0d02",
    "name": "Moderator",
    "permissions": [
        "notes",
        "accounts",
        "likes",
        "boosts",
        "emojis",
        "media",
        "blocks",
        "filters",
        "mutes",
        "reports",
        "settings",
        "roles",
        "notifications",
        "follows",
        "impersonate",
        "ignore_rate_limits",
        "instance",
        "instance:federation",
        "instance:settings"
    ],
    "priority": 100,
    "description": "Moderator role for managing content",
    "visible": true,
    "icon": "https://example.com/moderator.png"
}
```

## Update Role

```http
PATCH /api/v1/roles/:id
```

Update a role's data.

- **Returns**: `204 No Content`
- **Authentication**: Required
- **Permissions**: `roles`
- **Version History**:
  - `0.8.0`: Added.

### Request

- `name` (string, optional): The name of the role.
  - 1-128 characters.
- `permissions` (array of strings, optional): The permissions granted by the role. Defaults to an empty array.
- `priority` (number, optional): The priority of the role. Defaults to `0`.
- `description` (string, optional): A description of the role.
- `visible` (boolean, optional): Whether the role is visible in the UI. Defaults to `false`.
- `icon` (string, optional): An icon URL for the role.

#### Example

```http
PATCH /api/v1/roles/364fd13f-28b5-4e88-badd-ce3e533f0d02
Authorization: Bearer ...
Content-Type: application/json

{
    "name": "Moderator",
    "permissions": [
        "notes",
        "accounts",
        "likes",
        "boosts",
        "emojis",
        "media",
        "blocks",
        "filters",
        "mutes",
    ],
    "priority": 10,
    "description": "Moderator role for managing content",
    "visible": true,
    "icon": "https://example.com/moderator.png"
}
```

### Response

#### `204 No Content`

Role successfully updated.

## Delete Role

```http
DELETE /api/v1/roles/:id
```

Delete a role.

- **Returns**: `204 No Content`
- **Authentication**: Required
- **Permissions**: `roles`
- **Version History**:
  - `0.8.0`: Added.

### Request

#### Example

```http
DELETE /api/v1/roles/364fd13f-28b5-4e88-badd-ce3e533f0d
Authorization: Bearer ...
```

### Response

#### `204 No Content`

Role successfully deleted.

## Assign Role

```http
POST /api/v1/accounts/:id/roles/:role_id
```

Assign a role to an account.

- **Returns**: `204 No Content`
- **Authentication**: Required
- **Permissions**: `roles`
- **Version History**:
  - `0.8.0`: Added.

### Request

#### Example

```http
POST /api/v1/accounts/04608f74-6263-4a9a-bd7a-e778d4ac2ce4/roles/364fd13f-28b5-4e88-badd-ce3e533
Authorization: Bearer ...
```

### Response

#### `204 No Content`

Role successfully assigned.

## Unassign Role

```http
DELETE /api/v1/accounts/:id/roles/:role_id
```

Unassign a role from an account.

- **Returns**: `204 No Content`
- **Authentication**: Required
- **Permissions**: `roles`
- **Version History**:
  - `0.8.0`: Added.

### Request

#### Example

```http
DELETE /api/v1/accounts/04608f74-6263-4a9a-bd7a-e778d4ac2ce4/roles/364fd13f-28b5-4e88-badd-ce3e533
Authorization: Bearer ...
```

### Response

#### `204 No Content`

Role successfully unassigned.

## Get Account Roles

```http
GET /api/v1/accounts/:id/roles
```

Get a list of roles assigned to an account.

- **Returns**: Array of [`Role`](#role)
- **Authentication**: Not required
- **Permissions**: None
- **Version History**:
  - `0.8.0`: Added.

### Request

#### Example

```http
GET /api/v1/accounts/04608f74-6263-4a9a-bd7a-e778d4ac2ce4/roles
```

### Response

#### `200 OK`

Roles assigned to the account.

```json
[
    {
        "id": "364fd13f-28b5-4e88-badd-ce3e533f0d02",
        "name": "Moderator",
        "permissions": [
            "notes",
            "accounts",
            "likes",
            "boosts",
            "emojis",
            "media",
            "blocks",
            "filters",
            "mutes",
            "reports",
            "settings",
            "roles",
            "notifications",
            "follows",
            "impersonate",
            "ignore_rate_limits",
            "instance",
            "instance:federation",
            "instance:settings"
        ],
        "priority": 100,
        "description": "Moderator role for managing content",
        "visible": true,
        "icon": "https://example.com/moderator.png"
    }
]
```
