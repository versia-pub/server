const stringToBase64Hash = async (str: string): Promise<string> => {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = new Uint8Array(hashBuffer);

    return hashArray.toBase64();
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer =>
    Uint8Array.fromBase64(base64).buffer as ArrayBuffer;

/**
 * Signs a request using the Ed25519 algorithm, according to the [**Versia**](https://versia.pub/signatures) specification.
 *
 * @see https://versia.pub/signatures
 * @param privateKey - Private key of the User that is signing the request.
 * @param authorUrl - URL of the User that is signing the request.
 * @param req - Request to sign.
 * @param timestamp - (optional) Timestamp of the request.
 * @returns The signed request.
 */
export const sign = async (
    privateKey: CryptoKey,
    authorUrl: URL,
    req: Request,
    timestamp = new Date(),
): Promise<Request> => {
    const body = await req.clone().text();
    const url = new URL(req.url);

    const digest = await stringToBase64Hash(body);
    const timestampSecs = Math.floor(timestamp.getTime() / 1000);

    const signedString = `${req.method.toLowerCase()} ${encodeURI(
        url.pathname,
    )} ${timestampSecs} ${digest}`;

    const signature = await crypto.subtle.sign(
        "Ed25519",
        privateKey,
        new TextEncoder().encode(signedString),
    );

    const signatureBase64 = new Uint8Array(signature).toBase64();

    const newReq = new Request(req, {
        headers: {
            ...req.headers,
            "Versia-Signature": signatureBase64,
            "Versia-Signed-At": String(timestampSecs),
            "Versia-Signed-By": authorUrl.href,
        },
    });

    return newReq;
};

/**
 * Verifies a signed request using the Ed25519 algorithm, according to the [**Versia**](https://versia.pub/signatures) specification.
 *
 * @see https://versia.pub/signatures
 * @param publicKey - Public key of the User that is verifying the request.
 * @param req - Request to verify.
 * @returns Whether the request signature is valid or not.
 */
export const verify = async (
    publicKey: CryptoKey,
    req: Request,
): Promise<boolean> => {
    const signature = req.headers.get("Versia-Signature");
    const signedAt = req.headers.get("Versia-Signed-At");
    const signedBy = req.headers.get("Versia-Signed-By");

    if (!(signature && signedAt && signedBy)) {
        return false;
    }

    const body = await req.clone().text();
    const url = new URL(req.url);

    const digest = await stringToBase64Hash(body);

    const expectedSignedString = `${req.method.toLowerCase()} ${encodeURI(
        url.pathname,
    )} ${signedAt} ${digest}`;

    // Check if this matches the signature
    return crypto.subtle.verify(
        "Ed25519",
        publicKey,
        base64ToArrayBuffer(signature),
        new TextEncoder().encode(expectedSignedString),
    );
};
