# Federation API

The Federation API contains a variety of endpoints for interacting with the Lysand remote network.

## Refetch User

```http
POST /api/v1/accounts/:id/refetch
```

Refetches the user's account from the remote network.

### Response

Returns the updated account object.
```ts
// 200 OK
{
    id: string,
    ... // Account object
}
```