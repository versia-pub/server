import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import type { Config } from "~/packages/config-manager";

export const checkConfig = async (config: Config) => {
    await checkOidcConfig(config);

    await checkHttpProxyConfig(config);

    await checkChallengeConfig(config);
};

const checkHttpProxyConfig = async (config: Config) => {
    const logger = getLogger("server");

    if (config.http.proxy.enabled) {
        if (!config.http.proxy.address) {
            logger.fatal`The HTTP proxy is enabled, but the proxy address is not set in the config`;

            // Hang until Ctrl+C is pressed
            await Bun.sleep(Number.POSITIVE_INFINITY);
        }

        logger.info`HTTP proxy enabled at ${chalk.gray(config.http.proxy.address)}, testing...`;

        // Test the proxy
        const response = await fetch("https://api.ipify.org?format=json", {
            proxy: config.http.proxy.address,
        });

        const ip = (await response.json()).ip;

        logger.info`Your IPv4 address is ${chalk.gray(ip)}`;

        if (!response.ok) {
            logger.fatal`The HTTP proxy is enabled, but the proxy address is not reachable`;

            // Hang until Ctrl+C is pressed
            await Bun.sleep(Number.POSITIVE_INFINITY);
        }
    }
};

const checkChallengeConfig = async (config: Config) => {
    const logger = getLogger("server");

    if (
        config.validation.challenges.enabled &&
        !config.validation.challenges.key
    ) {
        logger.fatal`Challenges are enabled, but the challenge key is not set in the config`;
        logger.fatal`Below is a generated key for you to copy in the config at validation.challenges.key`;

        const key = await crypto.subtle.generateKey(
            {
                name: "HMAC",
                hash: "SHA-256",
            },
            true,
            ["sign"],
        );

        const exported = await crypto.subtle.exportKey("raw", key);

        const base64 = Buffer.from(exported).toString("base64");

        logger.fatal`Generated key: ${chalk.gray(base64)}`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }
};

const checkOidcConfig = async (config: Config) => {
    const logger = getLogger("server");

    if (!config.oidc.jwt_key) {
        logger.fatal`The JWT private key is not set in the config`;
        logger.fatal`Below is a generated key for you to copy in the config at oidc.jwt_key`;

        // Generate a key for them
        const keys = await crypto.subtle.generateKey("Ed25519", true, [
            "sign",
            "verify",
        ]);

        const privateKey = Buffer.from(
            await crypto.subtle.exportKey("pkcs8", keys.privateKey),
        ).toString("base64");

        const publicKey = Buffer.from(
            await crypto.subtle.exportKey("spki", keys.publicKey),
        ).toString("base64");

        logger.fatal`Generated key: ${chalk.gray(`${privateKey};${publicKey}`)}`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

    // Try and import the key
    const privateKey = await crypto.subtle
        .importKey(
            "pkcs8",
            Buffer.from(config.oidc.jwt_key.split(";")[0], "base64"),
            "Ed25519",
            false,
            ["sign"],
        )
        .catch((e) => e as Error);

    // Try and import the key
    const publicKey = await crypto.subtle
        .importKey(
            "spki",
            Buffer.from(config.oidc.jwt_key.split(";")[1], "base64"),
            "Ed25519",
            false,
            ["verify"],
        )
        .catch((e) => e as Error);

    if (privateKey instanceof Error || publicKey instanceof Error) {
        logger.fatal`The JWT key could not be imported! You may generate a new one by removing the old one from the config and restarting the server (this will invalidate all current JWTs).`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }
};
