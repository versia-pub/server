import Login from "./login.vue";
import Home from "./Home.vue";
import Register from "./Register.vue";
import RegistrationSuccess from "./RegistrationSuccess.vue";

export default [
	{ path: "/", component: Home },
	{ path: "/oauth/authorize", component: Login },
	{ path: "/register", component: Register },
	{ path: "/register/success", component: RegistrationSuccess },
];
