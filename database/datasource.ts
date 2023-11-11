import { DataSource } from "typeorm";
import { getConfig } from "../utils/config";
import { PrismaClient } from "@prisma/client";

const config = getConfig();

const AppDataSource = new DataSource({
	type: "postgres",
	host: config.database.host,
	port: config.database.port,
	username: config.database.username,
	password: config.database.password,
	database: config.database.database,
	synchronize: true,
	entities: [process.cwd() + "/database/entities/*.ts"],
});

const client = new PrismaClient({
	datasourceUrl: `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
});

export { AppDataSource, client };
