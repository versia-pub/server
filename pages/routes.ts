import Login from "./login.vue";
import Home from "./Home.vue";

export default [
	{ path: "/", component: Home },
	{ path: "/oauth/authorize", component: Login },
];
