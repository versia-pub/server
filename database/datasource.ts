import { DataSource } from "typeorm";
import { getConfig } from "../utils/config";

const config = getConfig();

const AppDataSource = new DataSource({
	type: "postgres",
	host: config.database.host,
	port: config.database.port,
	username: config.database.username,
	password: config.database.password,
	database: config.database.database,
	synchronize: true,
	entities: ["./entities/*.ts"],
});

export { AppDataSource };
