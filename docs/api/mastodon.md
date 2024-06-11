# Mastodon API Extensions

Extra attributes have been added to some Mastodon API routes. Changes are documented in this document.

## `/api/v1/instance`

Three extra attributes have been added to the `/api/v1/instance` endpoint:

```ts
{
    // ...
    banner: string | null;
    lysand_version: string;
    sso: {
        forced: boolean;
        providers: {
            id: string;
            name: string;
            icon?: string;
        }[];
    }
}
```

### `banner`

The URL of the instance's banner image. `null` if there is no banner set.

### `lysand_version`

The version of the Lysand instance.

The normal `version` field is always set to `"4.3.0+glitch"` or similar, to not confuse clients that expect a Mastodon instance.

### `sso`

Single Sign-On (SSO) settings for the instance. This object contains two fields:

- `forced`: If this is enabled, normal identifier/password login is disabled and login must be done through SSO.
- `providers`: An array of external OpenID Connect providers that users can link their accounts to. Each provider object contains the following fields:
  - `id`: The issuer ID of the OpenID Connect provider.
  - `name`: The name of the provider.
  - `icon`: The URL of the provider's icon. Optional.

## `/api/v2/instance`

Contains the same extensions as `/api/v1/instance`, except `banner` which uses the normal Mastodon API attribute.