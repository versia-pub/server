import { loadConfig } from "c12";
import { type Config, defaultConfig } from "config-manager/config.type";

const promise = loadConfig<Config>({
    configFile: "./config/config.toml",
    defaultConfig: defaultConfig,
});

export default defineEventHandler(async () => {
    const { config } = await promise;
    return {
        http: {
            bind: config?.http.bind,
            bind_port: config?.http.bind_port,
            base_url: config?.http.base_url,
            url: config?.http.bind.includes("http")
                ? `${config?.http.bind}:${config?.http.bind_port}`
                : `http://${config?.http.bind}:${config?.http.bind_port}`,
        },
    };
});
