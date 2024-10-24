import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import type { Config } from "~/packages/config-manager";

export const checkConfig = async (config: Config) => {
    await checkFederationConfig(config);

    await checkHttpProxyConfig(config);

    await checkChallengeConfig(config);
};

const checkHttpProxyConfig = async (config: Config) => {
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

const checkFederationConfig = async (config: Config) => {
    const logger = getLogger("server");

    if (!(config.instance.keys.public && config.instance.keys.private)) {
        logger.fatal`The federation keys are not set in the config at instance.keys.public and instance.keys.private`;
        logger.fatal`You can generate a keypair using the CLI command ${chalk.bold("generate-keys")}`;
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
