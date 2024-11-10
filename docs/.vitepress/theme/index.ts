import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
// https://vitepress.dev/guide/custom-theme
import { type VNode, h } from "vue";
import "./style.css";

export default {
    extends: DefaultTheme,
    Layout: (): VNode => {
        return h(DefaultTheme.Layout, null, {
            // https://vitepress.dev/guide/extending-default-theme#layout-slots
        });
    },
} satisfies Theme;
