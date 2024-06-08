# Roles API

The Roles API lets users manage roles given to them by administrators. This API is available to all users.

> [!WARNING]
> The API for **administrators** is different (and unimplemented): this is the API for **users**.
>
> Furthermore, users can only manage roles if they have the `roles` permission, and the role they wish to manage does not have a higher priority than their highest priority role.

## Priorities

Roles have a priority, which determines the order in which they are applied. Roles with higher priorities take precedence over roles with lower priorities.

Additionally, users cannot remove or add roles with a higher priority than their highest priority role.

## Visibility

Roles can be visible or invisible. Invisible roles are not shown to users in the UI, but they can still be managed via the API.

> [!WARNING]
> All roles assigned to a user are public information and can be retrieved via the API. The visibility of a role only affects whether it is shown in the UI, which clients can choose to respect or not.

## Permissions

Default permissions for anonymous users, logged-in users and admins can be set in config. These are always applied in addition to the permissions granted by roles. You may set them to empty arrays to exclusively use roles for permissions (make sure your roles are set up correctly).

```ts
// Last updated: 2024-06-07
// Search for "RolePermissions" in the source code (GitHub search bar) for the most up-to-date version
export enum RolePermissions {
    MANAGE_NOTES = "notes",
    MANAGE_OWN_NOTES = "owner:note",
    VIEW_NOTES = "read:note",
    VIEW_NOTE_LIKES = "read:note_likes",
    VIEW_NOTE_BOOSTS = "read:note_boosts",
    MANAGE_ACCOUNTS = "accounts",
    MANAGE_OWN_ACCOUNT = "owner:account",
    VIEW_ACCOUNT_FOLLOWS = "read:account_follows",
    MANAGE_LIKES = "likes",
    MANAGE_OWN_LIKES = "owner:like",
    MANAGE_BOOSTS = "boosts",
    MANAGE_OWN_BOOSTS = "owner:boost",
    VIEW_ACCOUNTS = "read:account",
    MANAGE_EMOJIS = "emojis",
    VIEW_EMOJIS = "read:emoji",
    MANAGE_OWN_EMOJIS = "owner:emoji",
    MANAGE_MEDIA = "media",
    MANAGE_OWN_MEDIA = "owner:media",
    MANAGE_BLOCKS = "blocks",
    MANAGE_OWN_BLOCKS = "owner:block",
    MANAGE_FILTERS = "filters",
    MANAGE_OWN_FILTERS = "owner:filter",
    MANAGE_MUTES = "mutes",
    MANAGE_OWN_MUTES = "owner:mute",
    MANAGE_REPORTS = "reports",
    MANAGE_OWN_REPORTS = "owner:report",
    MANAGE_SETTINGS = "settings",
    MANAGE_OWN_SETTINGS = "owner:settings",
    MANAGE_ROLES = "roles",
    MANAGE_NOTIFICATIONS = "notifications",
    MANAGE_OWN_NOTIFICATIONS = "owner:notification",
    MANAGE_FOLLOWS = "follows",
    MANAGE_OWN_FOLLOWS = "owner:follow",
    MANAGE_OWN_APPS = "owner:app",
    SEARCH = "search",
    VIEW_PUBLIC_TIMELINES = "public_timelines",
    VIEW_PRIVATE_TIMELINES = "private_timelines",
    IGNORE_RATE_LIMITS = "ignore_rate_limits",
    IMPERSONATE = "impersonate",
    MANAGE_INSTANCE = "instance",
    MANAGE_INSTANCE_FEDERATION = "instance:federation",
    MANAGE_INSTANCE_SETTINGS = "instance:settings",
    OAUTH = "oauth",
}
```

### Manage Roles

The `roles` permission allows the user to manage roles, including adding and removing roles from themselves. This permission is required to use the Roles API.

### Impersonate

The `impersonate` permission allows the user to impersonate other users (logging in with their credentials). This is a dangerous permission and should be used with caution.

### Manage Instance

The `instance` permission allows the user to manage the instance, including viewing logs, restarting the instance, and more.

### Manage Instance Federation

The `instance:federation` permission allows the user to manage the instance's federation settings, including blocking and unblocking other instances.

### Manage Instance Settings

The `instance:settings` permission allows the user to manage the instance's settings, including changing the instance's name, description, and more.

### OAuth2

The `oauth` permission is required for users to log in to the instance. Users who do not have this permission will not be able to log in.

## Get Roles

```http
GET /api/v1/roles
```

Retrieves a list of roles that the user has.

### Response

```ts
// 200 OK
{
    id: string;
    name: string;
    permissions: RolePermissions[];
    priority: number;
    description: string | null;
    visible: boolean;
    icon: string | null
}[];
```

## Get Role

```http
GET /api/v1/roles/:id
```

Retrieves information about a role.

### Response

```ts
// 200 OK
{
    id: string;
    name: string;
    permissions: RolePermissions[];
    priority: number;
    description: string | null;
    visible: boolean;
    icon: string | null
}
```

## Add Role

```http
POST /api/v1/roles/:id
```

Adds the role with the given ID to the user making the request.

### Response

```ts
// 204 No Content
```

## Remove Role

```http
DELETE /api/v1/roles/:id
```

Removes the role with the given ID from the user making the request.

### Response

```ts
// 204 No Content
```