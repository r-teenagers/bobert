import * as dotenv from "dotenv";
dotenv.config();

import { LogLevel, SapphireClient, container } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

import "@sapphire/plugin-logger/register";
import { setupConfig } from "./lib/config";

import { Database } from "bun:sqlite";
import * as schema from "@/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const sqlite = new Database("bobert.db");
container.database = drizzle(sqlite, { schema });

migrate(container.database, { migrationsFolder: "drizzle" });

const bot = new SapphireClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent,
	],
	defaultPrefix: "b!",
	loadMessageCommandListeners: true,
	logger: {
		level:
			process.env.NODE_ENV === "production" ? LogLevel.Info : LogLevel.Debug,
	},
});

container.processStartedAt = Math.floor(Date.now() / 1000);

setupConfig("./config.toml").then((c) => bot.login(c.bot.token));
