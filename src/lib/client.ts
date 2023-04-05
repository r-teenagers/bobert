import { PrismaClient } from "@prisma/client";
import { container, SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

const MINUTE = 60000;
const FIFTEEN_SECONDS = 15000;

export class BobertClient extends SapphireClient {
	public constructor() {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessageReactions,
			],
			loadDefaultErrorListeners: false,
		});

		this.startEggs();
	}

	// We override login to connect to our database and then login to Discord
	public override async login(token?: string) {
		container.database = new PrismaClient();
		return super.login(token);
	}

	// We override destroy to kill the connection to our database before logging out at Discord
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
}

declare module "@sapphire/pieces" {
	interface Container {
		database: PrismaClient;
	}
}
