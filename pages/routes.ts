import Login from "./login.vue";

const Home = { template: "<div>Home</div>" };

export default [
	{ path: "/", component: Home },
	{ path: "/oauth/authorize", component: Login },
];
