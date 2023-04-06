import { PrismaClient } from "@prisma/client";
import { SapphireClient, container } from "@sapphire/framework";
import {
	CategoryChannel,
	ClientOptions,
	GatewayIntentBits,
	Message,
} from "discord.js";
import { readFileSync } from "fs";

import { BobertConfig } from "./config";

import * as toml from "toml";

export class BobertClient extends SapphireClient {
	public constructor(options: ClientOptions, configPath: string) {
		super({
			...options,
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

const isBlankOrUndefined = (property: string | null): boolean =>
	!property || property === "";
