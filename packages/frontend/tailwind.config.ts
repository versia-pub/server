import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

// Default are on https://tailwindcss.nuxtjs.org/tailwind/config#default-configuration
export default (<Partial<Config>>{
    theme: {},
    plugins: [forms],
    content: [],
});
