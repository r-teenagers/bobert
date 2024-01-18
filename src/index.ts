import * as dotenv from "dotenv";
dotenv.config();

import { LogLevel, SapphireClient, container } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

import "@sapphire/plugin-logger/register";
import { setupConfig } from "./lib/config";

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../db/schema";

const sqlite = new Database("bobert.db");
container.database = drizzle(sqlite, { schema });

migrate(container.database, { migrationsFolder: "drizzle" });

const bot = new SapphireClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
	],
	logger: {
		level:
			process.env.NODE_ENV === "production" ? LogLevel.Info : LogLevel.Debug,
	},
});

setupConfig("./config.toml").then((c) => bot.login(c.bot.token));
