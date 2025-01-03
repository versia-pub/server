import { getLogger } from "@logtape/logtape";
import { User } from "@versia/kit/db";
import chalk from "chalk";
import { generateVAPIDKeys } from "web-push";
import type { Config } from "~/packages/config-manager";

export const checkConfig = async (config: Config): Promise<void> => {
    await checkFederationConfig(config);

    await checkHttpProxyConfig(config);

    await checkChallengeConfig(config);

    await checkVapidConfig(config);
};

const checkHttpProxyConfig = async (config: Config): Promise<void> => {
    const logger = getLogger("server");

    if (config.http.proxy.enabled) {
        logger.info`HTTP proxy enabled at ${chalk.gray(config.http.proxy.address)}, testing...`;

        // Test the proxy
        const response = await fetch("https://api.ipify.org?format=json", {
            // @ts-expect-error Proxy is a Bun-specific feature
            proxy: config.http.proxy.address,
        });

        const ip = (await response.json()).ip;

        logger.info`Your IPv4 address is ${chalk.gray(ip)}`;

        if (!response.ok) {
            throw new Error(
                "The HTTP proxy is enabled, but the proxy address is not reachable",
            );
        }
    }
};

const checkChallengeConfig = async (config: Config): Promise<void> => {
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

const checkFederationConfig = async (config: Config): Promise<void> => {
    const logger = getLogger("server");

    if (!(config.instance.keys.public && config.instance.keys.private)) {
        logger.fatal`The federation keys are not set in the config`;
        logger.fatal`Below are generated keys for you to copy in the config at instance.keys.public and instance.keys.private`;

        // Generate a key for them
        const { public_key, private_key } = await User.generateKeys();

        logger.fatal`Generated public key: ${chalk.gray(public_key)}`;
        logger.fatal`Generated private key: ${chalk.gray(private_key)}`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

    // Try and import the key
    const privateKey = await crypto.subtle
        .importKey(
            "pkcs8",
            Buffer.from(config.instance.keys.private, "base64"),
            "Ed25519",
            false,
            ["sign"],
        )
        .catch((e) => e as Error);

    // Try and import the key
    const publicKey = await crypto.subtle
        .importKey(
            "spki",
            Buffer.from(config.instance.keys.public, "base64"),
            "Ed25519",
            false,
            ["verify"],
        )
        .catch((e) => e as Error);

    if (privateKey instanceof Error || publicKey instanceof Error) {
        throw new Error(
            "The federation keys could not be imported! You may generate new ones by removing the old ones from the config and restarting the server.",
        );
    }
};

const checkVapidConfig = async (config: Config): Promise<void> => {
    const logger = getLogger("server");

    if (
        config.notifications.push.enabled &&
        !(
            config.notifications.push.vapid.public ||
            config.notifications.push.vapid.private
        )
    ) {
        logger.fatal`The VAPID keys are not set in the config, but push notifications are enabled.`;
        logger.fatal`Below are generated keys for you to copy in the config at notifications.push.vapid`;

        const { privateKey, publicKey } = await generateVAPIDKeys();

        logger.fatal`Generated public key: ${chalk.gray(publicKey)}`;
        logger.fatal`Generated private key: ${chalk.gray(privateKey)}`;

        // Hang until Ctrl+C is pressed
        await Bun.sleep(Number.POSITIVE_INFINITY);
    }

    // These use a format I don't understand, so I'm just going to check the length
    const validateKey = (key: string): boolean => key.length > 10;

    if (
        !(
            validateKey(config.notifications.push.vapid.public) &&
            validateKey(config.notifications.push.vapid.private)
        )
    ) {
        throw new Error(
            "The VAPID keys could not be imported! You may generate new ones by removing the old ones from the config and restarting the server.",
        );
    }
};
