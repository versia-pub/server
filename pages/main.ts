import { createApp } from "vue";
import "./style.css";
import "virtual:uno.css";
import { createRouter, createWebHistory } from "vue-router";
import Login from "./login.vue";
import App from "./App.vue";

const Home = { template: "<div>Home</div>" };

const routes = [
	{ path: "/", component: Home },
	{ path: "/oauth/authorize", component: Login },
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

const app = createApp(App);
app.use(router);

app.mount("#app");
