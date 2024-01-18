import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";

import { count, desc, eq } from "drizzle-orm";
import { players, teams } from "../../db/schema";
import updateEmbed from "../lib/updateEmbed";

export class JoinTeamHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		});
	}

	public override parse(interaction: ButtonInteraction) {
		if (interaction.customId !== "joinTeam") return this.none();

		return this.some();
	}

	public async run(interaction: ButtonInteraction) {
		if (!interaction.guild) return;

		// we don't want to run this if the user has a team already
		const existingPlayer = await this.container.database
			.select()
			.from(players)
			.where(eq(players.snowflake, interaction.user.id));

		if (existingPlayer.length === 1) {
			await interaction.reply({
				content: "You are already on a team!",
				ephemeral: true,
			});
			return;
		}

		// find the team with the fewest members
		const smallestTeam = await this.container.database
			.select({
				snowflake: teams.snowflake,
			})
			.from(teams)
			.leftJoin(players, eq(teams.snowflake, players.team))
			.groupBy(teams.snowflake)
			.orderBy(desc(count(players.team)));

		if (smallestTeam.length === 0) {
			this.container.logger.error("Could not get smallest team!");
			return;
		}

		const role = await interaction.guild.roles.fetch(smallestTeam[0].snowflake);

		if (!role) {
			this.container.logger.error("Failed to fetch smallest team role!");
			return;
		}

		const guildMember = await interaction.guild.members.fetch(
			interaction.user.id,
		);

		if (!guildMember) {
			this.container.logger.error("Failed to get guild member!");
			return;
		}

		guildMember.roles.add(role);

		await this.container.database.insert(players).values({
			snowflake: interaction.user.id,
			team: smallestTeam[0].snowflake,
			score: 0,
		});

		await interaction.reply({
			content: `You have joined team ${role.name}. Congratulations!`,
			ephemeral: true,
		});

		await updateEmbed();
	}
}
