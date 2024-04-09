import { presetForms } from "@julr/unocss-preset-forms";
import transformerDirectives from "@unocss/transformer-directives";

import {
    defineConfig,
    presetTypography,
    presetUno,
    presetWebFonts,
} from "unocss";

export default defineConfig({
    presets: [
        presetUno(),
        presetTypography({
            cssExtend: {
                "h1,h2,h3,h4,h5.h6": {
                    "font-family": "'Poppins'",
                },
            },
        }),
        presetWebFonts(),
        presetForms(),
    ],
    transformers: [transformerDirectives()],
});
