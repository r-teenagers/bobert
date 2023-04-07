import { BobertClient } from "../lib/client";
import { BobertItem } from "../lib/config";
import updateEmbed from "../lib/updateEmbed";

import { Listener } from "@sapphire/framework";
import {
	CategoryChannel,
	ChannelType,
	Collection,
	MessageReaction,
	TextChannel,
	User,
} from "discord.js";

const MINUTE = 60000;
const FIFTEEN_SECONDS = 15000;

export class SendEggsListener extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			name: "sendEggs",
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

		this.sendEgg(client, gameCategoryId, blacklistedChannels, items);
	}

	private async sendEgg(
		client: BobertClient,
		gameCategoryId: string,
		blacklistedChannels: string[] | null,
		items: BobertItem[],
	) {
		// The selected channel needs to be a TextChannel that is NOT blacklisted
		// it would probably work in voice text etc., but it's easier this way
		const channel: TextChannel = client.channels.cache
			.filter(
				(c) =>
					c.type === ChannelType.GuildText &&
					c.parent?.id === gameCategoryId &&
					!blacklistedChannels?.includes(c.id),
			)
			.random() as TextChannel; // TypeScript apparently isn't smart enough to infer this

		// JS has no builtin random choice function for arrays.
		// ridiculous.
		const item = this.weightedRandom(items);

		this.container.logger.debug(
			`Selected item ${JSON.stringify(item, null, 2)}`,
		);

		const message = await channel.send(item.emoji);

		// auto reaction should default to true!
		if (item.auto_react !== false) {
			message.react(item.response);
		}

		this.container.logger.info(`Egg sent in #${channel.name} (${channel.id})!`);

		// filter is defined here because it's dynamic based on the item response
		const reactionFilter = async (
			reaction: MessageReaction,
			user: User,
		): Promise<boolean> => {
			if (user.bot) return false;
			if (reaction.emoji.name !== item.response) return false;

			const prisma = this.container.database;
			const player = await prisma.player.findUnique({
				where: {
					snowflake: user.id,
				},
			});

			// if the player isn't in the database, they don't have a team yet
			if (!player || player.blacklisted) return false;

			return true;
		};

		/* ----------------
			  REACTION STAGE
			 ---------------- */

		message
			.awaitReactions({ filter: reactionFilter, max: 1, time: 10_000 })
			.then(async (reactions: Collection<string, MessageReaction>) => {
				// we don't want to clutter the channels
				await message.delete();

				// for some reason this gets called even if the time limit is reached
				// this if statement runs if no USERS reacted (item missed)
				if (reactions.size === 0) {
					this.container.logger.info(
						`${item.name} missed in #${channel.name} (${channel.id}).`,
					);
					return;
				}

				// by this point, we know a player got it (not a bot)
				// the reactions cache includes the bot's reaction
				const firstReaction = reactions.first();

				if (!firstReaction) {
					this.container.logger.error("Couldn't get first reaction!");
					return;
				}

				const reactedByUser = firstReaction.users.cache
					.filter((u) => !u.bot)
					.first();

				if (!reactedByUser) {
					this.container.logger.error("Couldn't find the user who reacted!");
					return;
				}

				this.container.logger.info(
					`${item.name} collected by ${reactedByUser?.username}#${reactedByUser?.discriminator} in #${channel.name} (${channel.id}).`,
				);

				console.log(reactedByUser.id);

				await this.container.database.player.update({
					where: {
						snowflake: reactedByUser.id,
					},
					data: {
						score: {
							increment: item.net_score,
						},
					},
				});

				await updateEmbed(client);
			});

		// this should generate an interval between 15 seconds and 1:15
		const timeout = Math.random() * MINUTE + FIFTEEN_SECONDS;
		this.container.logger.info(
			`Sending next egg in ${Math.round(timeout) / 1000} seconds.`,
		);

		setTimeout(
			() => this.sendEgg(client, gameCategoryId, blacklistedChannels, items),
			timeout,
		);
	}

	private weightedRandom(items: BobertItem[]): BobertItem {
		// gets the sum of the weight of each item
		const totalWeight = items.reduce(
			(x: number, i: BobertItem) => (x += i.weight || 1),
			0,
		);

		// i am drunk.
		let selectionAcc = Math.ceil(Math.random() * totalWeight);

		this.container.logger.debug(
			`Weighted selection generated ${selectionAcc}.`,
		);

		for (const item of items) {
			if (selectionAcc <= (item.weight || 1)) {
				return item;
			}

			selectionAcc -= item.weight || 1;
		}

		this.container.logger.warn(
			"Weighted random did not return an item! Defaulting to first item.",
		);
		return items[0];
	}
}
