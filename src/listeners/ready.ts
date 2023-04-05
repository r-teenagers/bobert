import { BobertClient } from "../lib/client";
import { Listener } from "@sapphire/framework";
import { ChannelType, TextChannel } from "discord.js";

const MINUTE = 60000;
const FIFTEEN_SECONDS = 15000;

export class ReadyListener extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			once: true,
			event: "ready",
		});
	}

	public run(client: BobertClient) {
		this.container.logger.info("Client is ready! Starting to send eggs.");

		const gameCategoryId = this.container.config.bot.category;
		const blacklistedChannels = this.container.config.bot.blacklisted_channels;
		const category = client.channels.cache.get(gameCategoryId);

		const items = this.container.config.event.items;

		if (!category || category.type !== ChannelType.GuildCategory) {
			this.container.logger.fatal("Couldn't find the given category. Exiting.");
			process.exit(1);
		}

		this.container.category_cache = category;

		// This is recursive, so it's easiest to define it here
		const sendEgg = async () => {
			// The selected channel needs to be a TextChannel that is NOT blacklisted
			// it would probably work in voice text etc., but it's easier this way
			const channel: TextChannel = client.channels.cache
				.filter(
					(c) =>
						c.type === ChannelType.GuildText &&
						c.parent?.id === gameCategoryId &&
						!blacklistedChannels.includes(c.id),
				)
				.random() as TextChannel; // TypeScript apparently isn't smart enough to infer this

			// JS has no builtin random choice function for arrays.
			// ridiculous.
			const randomIndex = Math.random() * (items.length - 1);
			const item = items[randomIndex];

			let message = await channel.send(item.emoji);

			if (item.auto_react !== false) {
				message.react(item.response);
			}

			// this should generate an interval between 15 seconds and 1:15
			const timeout = Math.random() * MINUTE + FIFTEEN_SECONDS;
			this.container.logger.info(
				`Egg Sent! Sending next egg in ${Math.round(timeout) / 1000} seconds.`,
			);

			setTimeout(sendEgg, timeout);
		};

		sendEgg();
	}
}
