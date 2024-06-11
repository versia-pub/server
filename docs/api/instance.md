# Instance Endpoints

Extra endpoints have been added to the API to provide additional information about the instance.

## `/api/v1/instance/tos`

Returns the same output as Mastodon's `/api/v1/instance/extended_description`, but with the instance's Terms of Service. Configurable at `instance.tos_path` in config.

## `/api/v1/instance/privacy_policy`

Returns the same output as Mastodon's `/api/v1/instance/extended_description`, but with the instance's Privacy Policy. Configurable at `instance.privacy_policy_path` in config.