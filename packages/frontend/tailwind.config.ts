import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

// Default are on https://tailwindcss.nuxtjs.org/tailwind/config#default-configuration
export default (<Partial<Config>>{
    theme: {},
    plugins: [forms],
    content: [],
});
