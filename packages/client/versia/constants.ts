import pkg from "../package.json" with { type: "json" };

export const NO_REDIRECT = "urn:ietf:wg:oauth:2.0:oob";
export const DEFAULT_SCOPE = ["read", "write", "follow"];
export const DEFAULT_UA = `VersiaClient/${pkg.version} (+${pkg.homepage})`;
