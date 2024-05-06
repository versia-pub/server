<p align="center">
  <a href="https://lysand.org"><img src="https://cdn.lysand.org/logo-long-dark.webp" alt="Lysand Logo" height="110"></a>
</p>

![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white) ![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white) ![VS Code Insiders](https://img.shields.io/badge/VS%20Code%20Insiders-35b393.svg?style=for-the-badge&logo=visual-studio-code&logoColor=white) ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white) [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa?style=for-the-badge)](code_of_conduct.md)

## What is this?

**Lysand Server** is a federated social network server based on the [Lysand](https://lysand.org) protocol. It is currently in beta phase, with basic federation and almost complete Mastodon API support.

### Goals

- **Privacy**: Lysand is designed to be as private as possible. Unnecessary data is not stored, and data that is stored is done so securely.
- **Configurability**: High configurability is a key feature of Lysand. Almost every aspect of the server can be configured to suit your needs. If you feel like something is missing, please open an issue.
- **Security**: Lysand is designed with security in mind. It is built with modern security practices and technologies, and is constantly updated to ensure the highest level of security.
- **Performance**: Efficiency and speed are a key focus of Lysand. The design is non-monolithic, and is built to be as fast as possible.
- **Mastodon API compatibility**: Lysand is designed to be compatible with the Mastodon API, with Glitch-SOC extensions.

### Anti-Goals

- **Monolithic design**: Modularity and scaling is important to this project. This means that it is not a single, monolithic application, but rather a collection of smaller, more focused applications. (API layer, queue, database, frontend, etc.)
- **Complexity**: Both in code and in function, Lysand should be as simple as possible. This does not mean adding no features or functionality, but rather that the features and functionality that are added should be well-written and easy to understand.
- **Bloat**: Lysand should not be bloated with unnecessary features, packages, dependencies or code. It should be as lightweight as possible, while still being feature-rich.

## Features

- [x] Federation (partial)
- [x] Hyper fast (thousands of HTTP requests per second)
- [x] S3 or local media storage
- [x] Deduplication of uploaded files
- [x] Federation limits
- [x] Configurable defaults
- [x] Full regex-based filters for posts, users and media
- [x] Custom emoji support
- [x] Automatic image conversion to WebP or other formats
- [x] Scripting-compatible CLI with JSON and CSV outputs
- [x] Markdown support just about everywhere: posts, profiles, profile fields, etc. Code blocks, tables, and more are supported.
- [ ] Moderation tools
- [x] Mastodon API support (partial)

## Screenshots

You can visit [social.lysand.org](https://social.lysand.org) to see a live instance of Lysand with Lysand-FE.

## How do I run it?

Please see the [installation guide](docs/installation.md) for more information on how to install Lysand.

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Federation

The following extensions are currently supported or being worked on:
- `org.lysand:custom_emojis`: Custom emojis
- `org.lysand:polls`: Polls
- `org.lysand:microblogging`: Microblogging

## API

Lysand implements the Mastodon API (as well as Glitch-Soc extensions). The API is currently almost fully complete, with some fringe functionality still being worked on.

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
- [ ] `/oauth/revoke`
- Admin API  

### Main work to do

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

## License

This project is licensed under the [AGPL-3.0-or-later](LICENSE).
