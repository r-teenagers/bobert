import { eq } from "drizzle-orm";
import { players } from "@/schema";
import type { BobertItem } from "../lib/config";
import updateEmbed from "../lib/updateEmbed";

import { Events, Listener, SapphireClient } from "@sapphire/framework";
import {
	ChannelType,
	Collection,
	Message,
	MessageReaction,
	TextChannel,
	User,
} from "discord.js";
import { formattedPointsString, titleCaseOf } from "../lib/util";

export class SendEggsListener extends Listener {
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			name: "sendEggs",
			once: true,
			event: Events.ClientReady,
		});
	}

	public run(client: SapphireClient) {
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
		client: SapphireClient,
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

		const sentAt = Date.now();
		const message = await channel.send(item.emoji);

		// auto reaction should default to true!
		if (item.auto_react !== false) {
			message.react(item.response);
		}

		this.container.logger.info(`Egg sent in #${channel.name} (${channel.id})!`);

		/* ----------------
			  REACTION STAGE
			 ---------------- */

		// filter is defined here because it's dynamic based on the item response
		const reactionFilter = async (
			reaction: MessageReaction,
			user: User,
		): Promise<boolean> => {
			if (user.bot) return false;
			if (reaction.emoji.name !== item.response) return false;

			// checking roles is faster than hitting the db
			const member = reaction.message.guild?.members.cache.get(user.id);
			if (member?.roles.cache.hasAny(...this.container.config.event.teams))
				return true;

			// okay fine we might have just not assigned the role yet
			const player = await this.container.database
				.select()
				.from(players)
				.where(eq(players.snowflake, user.id));

			// if the player isn't in the database, they don't have a team yet
			if (player.length === 0 || player[0].blacklisted) return false;

			// in this case, the player is in the db so we're literally so chilling
			return true;
		};

		// we wait for the FIRST fitting reaction ONLY
		message
			.awaitReactions({
				filter: reactionFilter,
				max: 1,
				time: item.collection_indow || 10_000,
			})
			.then(async (reactions: Collection<string, MessageReaction>) => {
				this.claimMessage(message, channel, reactions, item, sentAt);
			});

		// this should generate an interval between min and max delay
		const timeout =
			Math.random() *
				((this.container.config.event.max_send_delay || 75000) -
					(this.container.config.event.min_send_delay || 60000)) +
			(this.container.config.event.min_send_delay || 60000);
		this.container.logger.info(
			`Sending next egg in ${Math.round(timeout) / 1000} seconds.`,
		);

		setTimeout(
			() => this.sendEgg(client, gameCategoryId, blacklistedChannels, items),
			timeout,
		);
	}

	private async claimMessage(
		message: Message,
		channel: TextChannel,
		reactions: Collection<string, MessageReaction>,
		item: BobertItem,
		sentAt: number,
	) {
		const collectedAfter = Date.now() - sentAt;

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

		const [player] = await this.container.database
			.select({ score: players.score })
			.from(players)
			.where(eq(players.snowflake, reactedByUser.id));

		await this.container.database
			.update(players)
			.set({
				score: player.score + item.net_score,
			})
			.where(eq(players.snowflake, reactedByUser.id));

		const res =
			item.net_score >= 0
				? `${titleCaseOf(
						item.name,
				  )} collected by ${reactedByUser} in ${collectedAfter}ms! They have earned ${
						item.net_score
				  } ${formattedPointsString(item.net_score)}.`
				: `${titleCaseOf(
						item.name,
				  )} collected by ${reactedByUser} in ${collectedAfter}ms. They have lost ${-item.net_score} ${formattedPointsString(
						item.net_score,
				  )}`;

		await message.channel.send(res);

		await updateEmbed();
	}

	// I don't remember writing this. I am positive there is a better way.
	// Currently, it's a super esoteric way of summing the weights then looping through
	// until we get to the item chosen by a random number (min 0, max totalWeight)
	// like what the FLIP was i thinking
	private weightedRandom(items: BobertItem[]): BobertItem {
		let totalWeight = 0;
		for (const item of items) {
			totalWeight += item.weight || 1;
		}

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
