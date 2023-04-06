import * as dotenv from "dotenv";
dotenv.config();

import { BobertClient } from "./lib/client";
import { LogLevel } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

import "@sapphire/plugin-logger/register";

const bot = new BobertClient(
	{
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessageReactions,
		],
		logger: {
			level:
				process.env.NODE_ENV === "production" ? LogLevel.Info : LogLevel.Debug,
		},
	},
	"./config.toml",
);

bot.login();
