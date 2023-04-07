import {
	InteractionHandler,
	InteractionHandlerTypes,
	PieceContext,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";

export class JoinTeamHandler extends InteractionHandler {
	public constructor(ctx: PieceContext, options: InteractionHandler.Options) {
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
		const existingPlayer = await this.container.database.player.findUnique({
			where: {
				snowflake: interaction.user.id,
			}
		});

		if (existingPlayer) {
			await interaction.reply({ content: "You are already on a team!", ephemeral: true });
			return;
		}

		// find the team with the fewest members
		const smallestTeam = await this.container.database.team.findFirst({
			orderBy: {
				players: {
					_count: "asc",
				},
			},
		});

		if (!smallestTeam) {
			this.container.logger.error("Could not get smallest team!");
			return;
		}

		const role = await interaction.guild.roles.fetch(smallestTeam.snowflake);

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

		await this.container.database.player.create({
			data: {
				snowflake: interaction.user.id,
				teamSnowflake: smallestTeam.snowflake,
				score: 0,
			},
		});

		await interaction.reply({
			content: `You have joined team ${role.name}. Congratulations!`,
			ephemeral: true,
		});
	}
}
