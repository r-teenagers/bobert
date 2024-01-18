import { Events, Listener } from "@sapphire/framework";
import { Message } from "discord.js";

import { players } from "../../db/schema";
import { eq } from "drizzle-orm";

export class AssignRoleListener extends Listener {
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			name: "assignRole",
			event: Events.GuildMemberAdd,
		});
	}

	public async run(message: Message) {
		// we DONT FLIPPING CARE if its not in a guild
		if (
			message.author.bot ||
			!message.member ||
			message.guildId !== this.container.config.bot.guild
		)
			return;

		const player = await this.container.database
			.select()
			.from(players)
			.where(eq(players.snowflake, message.author.id));

		// if the player isn't in the db they are not actively playing
		if (player.length < 1) return;

		const prevAssignedRole = player[0].team;

		if (!message.member.roles.cache.has(prevAssignedRole)) {
			await message.member.roles.add(prevAssignedRole);

			this.container.logger.warn(
				`Found player ${message.member.displayName} without a role. Added ${prevAssignedRole}.`,
			);
		}
	}
}
