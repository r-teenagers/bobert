import { PrismaClient } from "@prisma/client";
import { container, SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";
import { readFileSync } from "fs";

import * as toml from "toml";

const MINUTE = 60000;
const FIFTEEN_SECONDS = 15000;

export class BobertClient extends SapphireClient {
	public constructor(configPath: string) {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessageReactions,
			],
			loadDefaultErrorListeners: false,
		});

		this.setupConfig(configPath);
	}

	public override async login() {
		container.database = new PrismaClient();
		return super.login(container.config.bot.token);
	}

	public override async destroy() {
		await container.database.$disconnect();
		return super.destroy();
	}

	public startEggs() {
		const sendEgg = () => {
			// this should generate an interval between 15 seconds and 1:15
			const timeout = Math.random() * MINUTE + FIFTEEN_SECONDS;
			container.logger.info(
				`Egg Sent! Sending next egg in ${Math.round(timeout) / 1000} seconds.`,
			);

			setTimeout(sendEgg, timeout);
		};

		sendEgg();
	}

	private setupConfig(configPath: string) {
		const configToml = readFileSync(configPath).toString();
		const config = toml.parse(configToml);

		if (isBlankOrUndefined(config.bot.token)) {
			container.logger.fatal("Token not provided in config.toml. Exiting.");
			process.exit(1);
		}

		if (
			isBlankOrUndefined(config.bot.guild) ||
			isBlankOrUndefined(config.bot.category) ||
			isBlankOrUndefined(config.bot.scoreboard_channel)
		) {
			container.logger.fatal("Guild configuration not provided. Exiting.");
			process.exit(1);
		}

		if (
			config.event.teams.length === 0 ||
			config.event.teams.some((t: string) => t.length === 0)
		) {
			container.logger.fatal("Teams not provided or invalid. Exiting.");
			process.exit(1);
		}

		container.config = config;
	}
}

declare module "@sapphire/pieces" {
	interface Container {
		database: PrismaClient;
		config: BobertConfig;
	}
}

type BobertConfig = {
	bot: {
		token: string;
		guild: string;
		category: string;
		scoreboard_channel: string;
	};
	event: {
		teams: string[];
		items: {
			name: string;
			emoji: string;
			response: string;
			net_score: number;
			auto_react: boolean | null;
			weight: number | null;
		}[];
	};
};

const isBlankOrUndefined = (property: any): boolean =>
	!property || property === "";
