import { PrismaClient } from "@prisma/client";
import { LogLevel, SapphireClient, container } from "@sapphire/framework";
import { CategoryChannel, GatewayIntentBits, Message } from "discord.js";
import { readFileSync } from "fs";

import * as toml from "toml";

export class BobertClient extends SapphireClient {
	public constructor(configPath: string) {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessageReactions,
			],
			loadDefaultErrorListeners: false,
			logger: {
				level:
					process.env.NODE_ENV === "production"
						? LogLevel.Info
						: LogLevel.Debug,
			},
		});

		this.setupConfig(configPath);
	}

	public override async login(token: string) {
		container.database = new PrismaClient();
		console.log(container.config);
		return super.login(container.config.bot.token);
	}

	public override async destroy() {
		await container.database.$disconnect();
		return super.destroy();
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
		category_cache: CategoryChannel;
		config: BobertConfig;
		database: PrismaClient;
		scoreboard_message_cache: Message;
	}
}

type BobertConfig = {
	bot: {
		token: string;
		guild: string;
		category: string;
		blacklisted_channels: string[];
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

const isBlankOrUndefined = (property: string | null): boolean =>
	!property || property === "";
