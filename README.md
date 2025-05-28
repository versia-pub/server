<div align="center">
    <a href="https://versia.pub">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://cdn.versia.pub/branding/logo-dark.svg">
            <source media="(prefers-color-scheme: light)" srcset="https://cdn.versia.pub/branding/logo-light.svg">
            <img src="https://cdn.versia.pub/branding/logo-dark.svg" alt="Versia Logo" height="110" />
        </picture>
    </a>
</div>


<h2 align="center">
  <strong><code>Versia Server</code></strong>
</h2>

<div align="center">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" height="42" width="52" alt="TypeScript logo">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg" height="42" width="52" alt="PostgreSQL logo">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" height="42" width="52" alt="Docker logo">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bun/bun-original.svg" height="42" width="52" alt="Bun logo">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg" height="42" width="52" alt="VSCode logo">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sentry/sentry-original.svg" height="42" width="52" alt="Sentry logo">
    <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg" height="42" width="52" alt="Linux logo">
</div>


<br/>

## What is this?

**Versia Server** (formerly Lysand Server) is a federated social network server based on the [Versia](https://versia.pub) protocol. It is currently in beta phase, with basic federation and almost complete Mastodon API support.

### Goals

- **Privacy**: Versia Server is designed to be as private as possible. Unnecessary data is not stored, and data that is stored is done so securely.
- **Configurability**: High configurability is a key feature of Versia Server. Almost every aspect of the server can be configured to suit your needs. If you feel like something is missing, please open an issue.
- **Security**: Versia Server is designed with security in mind. It is built with modern security practices and technologies, and is constantly updated to ensure the highest level of security.
- **Performance**: Efficiency and speed are a key focus of Versia Server. The design is non-monolithic, and is built to be as fast as possible.
- **Mastodon API compatibility**: Versia Server is designed to be compatible with the Mastodon API, with [`glitch-soc`](https://github.com/glitch-soc/mastodon) extensions.

### Anti-Goals

- **Monolithic design**: Modularity and scaling is important to this project. This means that it is not a single, monolithic application, but rather a collection of smaller, more focused applications. (API layer, queue, database, frontend, etc.)
- **Complexity**: Both in code and in function, Versia Server should be as simple as possible. This does not mean adding no features or functionality, but rather that the features and functionality that are added should be well-written and easy to understand.
- **Bloat**: Versia Server should not be bloated with unnecessary features, packages, dependencies or code. It should be as lightweight as possible, while still being feature-rich.

## Features

- [x] Versia Working Draft 4 federation (partial)
- [x] Hyper fast (thousands of HTTP requests per second)
- [x] S3 or local media storage
- [x] Deduplication of uploaded files
- [x] Federation limits
- [x] Configurable defaults
- [x] Full regex-based filters for posts, users and media
- [x] Custom emoji support
- [x] Users can upload their own emojis for themselves
- [x] Automatic image conversion to WebP or other formats
- [x] Scripting-compatible CLI with JSON and CSV outputs
- [x] Markdown support just about everywhere: posts, profiles, profile fields, etc. Code blocks, tables, and more are supported.
- [ ] Advanced moderation tools (work in progress)
- [x] Fully compliant Mastodon API support (partial)
- [x] Glitch-SOC extensions
- [x] Full compatibility with many clients such as Megalodon
- [x] Ability to use your own frontends
- [x] Non-monolithic architecture, microservices can be hosted in infinite amounts on infinite servers
- [x] Ability to use all your threads
- [x] Support for SSO providers, as well as SSO-only registration.
- [x] Fully written in TypeScript and thoroughly unit tested
- [x] Automatic signed container builds for easy deployment
- [x] Docker and Podman supported
- [x] Invisible, Proof-of-Work local CAPTCHA for API requests
- [x] Advanced Roles and Permissions API.
- [x] HTTP proxy support
- [x] Tor hidden service support
- [x] Sentry logging support
- [x] Ability to change the domain name in a single config change, without any database edits

## Screenshots

You can visit [social.lysand.org](https://social.lysand.org) to see a live instance of Versia Server with Versia-FE.

## How do I run it?

Please see the [installation guide](https://server.versia.pub/setup/installation) for more information on how to install Versia.

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Federation

The following extensions are currently supported or being worked on:
- `pub.versia:custom_emojis`: Custom emojis
- `pub.versia:instance_messaging`: Instance Messaging
- `pub.versia:likes`: Likes
- `pub.versia:share`: Share
- `pub.versia:reactions`: Reactions

## API

Versia Server implements the Mastodon API (as well as `glitch-soc` extensions). The API is currently almost fully complete, with some fringe functionality still being worked on.

Working endpoints are:

- [x] `/api/v1/accounts/:id/block`
- [x] `/api/v1/accounts/:id/follow`
- [x] `/api/v1/accounts/:id/followers`
- [x] `/api/v1/accounts/:id/following`
- [ ] `/api/v1/accounts/:id/lists`
- [x] `/api/v1/accounts/:id/mute`
- [x] `/api/v1/accounts/:id/note`
- [x] `/api/v1/accounts/:id/pin`
- [x] `/api/v1/accounts/:id/remove_from_followers`
- [x] `/api/v1/accounts/:id/statuses`
- [x] `/api/v1/accounts/:id/unblock`
- [x] `/api/v1/accounts/:id/unfollow`
- [x] `/api/v1/accounts/:id/unmute`
- [x] `/api/v1/accounts/:id/unpin`
- [x] `/api/v1/accounts/:id`
- [x] `/api/v1/accounts/familiar_followers`
- [x] `/api/v1/accounts/relationships`
- [x] `/api/v1/accounts/update_credentials`
- [x] `/api/v1/accounts/verify_credentials`
- [x] `/api/v1/accounts`
- [ ] `/api/v1/announcements/:id/dismiss`
- [ ] `/api/v1/announcements/:id/reactions/:name` (`PUT`, `DELETE`)
- [ ] `/api/v1/announcements`
- [x] `/api/v1/apps/verify_credentials`
- [x] `/api/v1/apps`
- [x] `/api/v1/blocks`
- [ ] `/api/v1/conversations/:id/read`
- [ ] `/api/v1/conversations/:id`
- [ ] `/api/v1/conversations`
- [x] `/api/v1/custom_emojis`
- [ ] `/api/v1/directory`
- [ ] `/api/v1/domain_blocks` (`GET`, `POST`, `DELETE`)
- [ ] `/api/v1/endorsements`
- [x] `/api/v1/favourites`
- [ ] `/api/v1/featured_tags/:id` (`DELETE`)
- [ ] `/api/v1/featured_tags/suggestions`
- [ ] `/api/v1/featured_tags` (`GET`, `POST`)
- [x] `/api/v1/follow_requests/:account_id/authorize`
- [x] `/api/v1/follow_requests/:account_id/reject`
- [x] `/api/v1/follow_requests`
- [ ] `/api/v1/follow_suggestions`
- [ ] `/api/v1/followed_tags`
- [ ] `/api/v1/instance/activity`
- [ ] `/api/v1/instance/domain_blocks`
- [x] `/api/v1/instance/extended_description`
- [ ] `/api/v1/instance/peers`
- [x] `/api/v1/instance/rules`
- [x] `/api/v1/instance`
- [ ] `/api/v1/lists/:id/accounts` (`GET`, `POST`, `DELETE`)
- [ ] `/api/v1/lists/:id` (`GET`, `PUT`, `DELETE`)
- [ ] `/api/v1/lists` (`GET`, `POST`)
- [x] `/api/v1/markers` (`GET`, `POST`)
- [x] `/api/v1/media/:id`
- [x] `/api/v1/mutes`
- [x] `/api/v1/notifications/:id/dismiss`
- [x] `/api/v1/notifications/:id`
- [x] `/api/v1/notifications/clear`
- [x] `/api/v1/notifications`
- [ ] `/api/v1/polls/:id/votes`
- [ ] `/api/v1/polls/:id`
- [ ] `/api/v1/preferences`
- [x] `/api/v1/profile/avatar` (`DELETE`)
- [x] `/api/v1/profile/header` (`DELETE`)
- [ ] `/api/v1/reports`
- [ ] `/api/v1/scheduled_statuses/:id` (`GET`, `PUT`, `DELETE`)
- [ ] `/api/v1/scheduled_statuses`
- [ ] `/api/v1/statuses/:id/bookmark`
- [x] `/api/v1/statuses/:id/context`
- [x] `/api/v1/statuses/:id/favourite`
- [x] `/api/v1/statuses/:id/favourited_by`
- [ ] `/api/v1/statuses/:id/history`
- [x] `/api/v1/statuses/:id/mute`
- [x] `/api/v1/statuses/:id/pin`
- [x] `/api/v1/statuses/:id/reblog`
- [x] `/api/v1/statuses/:id/reblogged_by`
- [x] `/api/v1/statuses/:id/source`
- [ ] `/api/v1/statuses/:id/translate`
- [ ] `/api/v1/statuses/:id/unbookmark`
- [x] `/api/v1/statuses/:id/unfavourite`
- [x] `/api/v1/statuses/:id/unmute`
- [x] `/api/v1/statuses/:id/unpin`
- [x] `/api/v1/statuses/:id/unreblog`
- [x] `/api/v1/statuses/:id` (`GET`, `DELETE`)
- [x] `/api/v1/statuses/:id` (`PUT`)
- [x] `/api/v1/statuses`
- [ ] `/api/v1/suggestions/:account_id` (`DELETE`)
- [ ] `/api/v1/tags/:id/follow`
- [ ] `/api/v1/tags/:id/unfollow`
- [ ] `/api/v1/tags/:id`
- [x] `/api/v1/timelines/home`
- [ ] `/api/v1/timelines/list/:list_id`
- [x] `/api/v1/timelines/public`
- [ ] `/api/v1/timelines/tag/:hashtag`
- [ ] `/api/v1/trends/links`
- [ ] `/api/v1/trends/statuses`
- [ ] `/api/v1/trends/tags`
- [ ] `/api/v2/filters/:filter_id/keywords` (`GET`, `POST`)
- [ ] `/api/v2/filters/:filter_id/statuses` (`GET`, `POST`)
- [x] `/api/v2/filters/:id` (`GET`, `PUT`, `DELETE`)
- [ ] `/api/v2/filters/keywords/:id` (`GET`, `PUT`, `DELETE`)
- [ ] `/api/v2/filters/statuses/:id` (`GET`, `DELETE`)
- [x] `/api/v2/filters` (`GET`, `POST`)
- [x] `/api/v2/instance`
- [x] `/api/v2/media`
- [x] `/api/v2/search`
- [ ] `/api/v2/suggestions`
- [x] `/oauth/authorize`
- [x] `/oauth/token`
- [x] `/oauth/revoke`
- Admin API

### Main work to do for API

- [ ] Announcements
- [ ] Polls
- [ ] Tags
- [ ] Lists
- [ ] Scheduled statuses
- [ ] WebSockets
- [ ] Push notifications
- [ ] Trends
- [ ] Suggestions
- [ ] Bookmarks
- [ ] Translation
- [ ] Reports
- [ ] Admin API

## Versia Server API

For Versia Server's own custom API, please see the [API documentation](https://server.versia.pub/api/emojis).

## License

This project is licensed under the [AGPL-3.0-or-later](LICENSE).

All Versia assets (icon, logo, banners, etc) are licensed under [CC-BY-NC-SA-4.0](https://creativecommons.org/licenses/by-nc-sa/4.0)

## Thanks!

Thanks to [**Fastly**](https://fastly.com) for providing us with support and resources to build Versia!

<br />

<p align="center">
    <a href="https://fastly.com">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="assets/fastly-red.svg">
            <source media="(prefers-color-scheme: light)" srcset="assets/fastly-red.svg">
            <img src="assets/fastly-red.svg" alt="Fastly Logo" height="110" />
        </picture>
    </a>
</p>
