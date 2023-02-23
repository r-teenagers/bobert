
import discord
import json
import logging
import random
import asyncio
import os
import datetime
import pytz

from discord.ext import commands, tasks
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(format="%(asctime)s %(levelname)s: %(message)s", datefmt="[%a %b %d %H:%M:%S %Y]", level=logging.INFO)


class EggSpammer(commands.Cog):

    def __init__(self, bot):

        self.bot = bot
        self.reaction_cooldown = []
        self.egg_interval = 16
        self.mod_channel = self.bot.get_channel(int(os.getenv("MOD_CHANNEL")))
        if self.bot.config_set:
            self.send_egg_message.start()

    # --- commands ---

    @commands.command()
    async def start(self, ctx, channel):

        if ctx.author.id != int(os.getenv("AUTHORIZED_USER")):
            return

        if self.bot.config_set:
            return await ctx.send("Could not initialize! Variables already set. Please edit leaderboard.json "
                                  "to not have message channels and react role channels already set.")

        channel = self.bot.get_channel(int(channel))

        score_embed = discord.Embed(title="Scoreboards", description= None)
        reaction_embed = discord.Embed(title="Grab your team role here!",
                                       description="Teams are randomized for balance.")

        for role in self.bot.teams:
            guild = self.bot.current_guild
            role = discord.utils.get(guild.roles, id=role)
            score_embed.add_field(name=role.name, value="0")
            reaction_embed.add_field(name=role.name, value=f"Number of members: {len(role.members)}")

        score_msg = await channel.send(embed=score_embed)
        role_msg = await channel.send(embed=reaction_embed)

        await role_msg.add_reaction("🥚")

        self.bot.scoreboard_channel = channel
        self.bot.scoreboard_message = score_msg
        self.bot.react_role_channel = channel
        self.bot.react_role_message = role_msg

        with open("config.json") as config:
            data = json.load(config)

        data["set"] = True
        data["scoreboard_message"] = {str(self.bot.scoreboard_channel.id): str(self.bot.scoreboard_message.id)}
        data["react_role_message"] = {str(self.bot.react_role_channel.id): str(self.bot.react_role_message.id)}

        with open("config.json", "w") as config:
            json.dump(data, config)

        self.send_egg_message.start()

    @commands.command()
    @commands.cooldown(1, 5, commands.BucketType.user)
    async def ping(self, ctx):
        if discord.utils.get(ctx.guild.roles, id=int(os.getenv("MOD_ROLE"))) not in ctx.author.roles:
            return

        await ctx.send('Pong! My ping is {0}.'.format(round(self.bot.latency)))

    @commands.command()
    @commands.cooldown(1, 5, commands.BucketType.user)
    async def score(self, ctx):

        with open("leaderboard.json") as leaderboard:
            data = json.load(leaderboard)

        try:
            score = data["users"][str(ctx.author.id)]
        except KeyError:
            score = 0

        try:
            scorestring = f"{score} eggs!" if score != 0 else f"{score} eggs :("
            await ctx.author.send(f"You have found {scorestring}")
        except:
            await ctx.send(f"{ctx.author.mention} Couldn't send you a DM! Please open your DMs.", delete_after=2)

        try:
            await ctx.message.delete()
        except:
            logging.warning("Missing manage messages permission!")

    @score.error
    async def score_error(self, ctx, error):
        if isinstance(error, commands.CommandOnCooldown):
            return

    @commands.command()
    async def blacklist(self, ctx, userid = None):

        if int(os.getenv("MOD_ROLE")) not in [role.id for role in ctx.author.roles]:
            return

        if userid is None:
            return await ctx.send("Please provide a proper user!")

        with open("config.json") as config:
            data = json.load(config)

        try:
            uid = int(userid)
        except ValueError:
            return await ctx.send("Please provide a valid user id!")

        data["blacklisted_users"].append(uid)
        self.bot.blacklisted_users.append(uid)

        with open("config.json", "w") as config:
            json.dump(data, config)

        embed = discord.Embed(title="You have been blacklisted",
                              description="You have been blocked from participating from the egg event. This bot will"
                                          "now ignore your reactions.",
                              timestamp=datetime.datetime.utcnow())

        await self.bot.current_guild.get_member(uid).send(embed=embed)
        await ctx.send(f"User <@{uid}> blacklisted")

    # -- File handler & message update --
    def update_statistics_file(self, user, entry, cracked):

        with open("leaderboard.json") as leaderboard:
            data = json.load(leaderboard)

        team = None
        for t in self.bot.teams:
            if t in [r.id for r in user.roles]:  # This is terrible
                team = t
                break
        if team is None:
            return

        # Add an entry for the user's role to avoid team switching for balance
        # This is a mess, but I don't want to restructure the lb while it's running
        if str(entry) not in data["roles"]:
            data["roles"][str(entry)] = team
            logging.info(f"{entry}'s role was not previously saved, added to leaderboard.json")

        delta = -1 if cracked else 1

        # Individual score can still be negative
        if str(entry) not in data["users"]:
            data["users"][str(entry)] = delta
        else:
            data["users"][str(entry)] += delta

        # Don't subtract from team score if user's score is negative - this should prevent throwing
        personal_eggs = data["users"][str(entry)]
        should_affect_team = personal_eggs >= 0 or delta == 1
        if should_affect_team:
            data["teams"][str(team)] += delta  # This can't not exist
        else:
            logging.info(f"User {entry} has {personal_eggs}, not subtracting from team score")

        with open("leaderboard.json", "w") as config:
            json.dump(data, config)

    async def update_leaderboard_message(self, ctx):

        embed = discord.Embed(title="Scoreboards")
        with open("leaderboard.json") as leaderboard:
            data = json.load(leaderboard)

        # I'm so sorry
        sorted_leaderboard = {k: v for k, v in reversed(sorted(data["users"].items(), key=lambda item: item[1]))}
        description = "Type `b!score` to check how many eggs you've collected!\n```py\n"
        newline = "\n"
        index = 1

        for user, score in sorted_leaderboard.items():

            try:
                user_name = self.bot.get_user(int(user)).name
            except AttributeError:
                user_name = str(user)

            if user_name is not None and int(user) not in self.bot.blacklisted_users:
                description += f"{index}. {user_name}: {score}" + newline
                index += 1
            if index == 11:
                break

        description += "```"
        embed.description = description

        for role in self.bot.teams:
            guild = self.bot.current_guild

            role = discord.utils.get(guild.roles, id=role)
            embed.add_field(name=role.name, value=data["teams"][str(role.id)])

        await self.bot.scoreboard_message.edit(content=None, embed=embed)

    async def update_role_message(self):
        reaction_embed = discord.Embed(title="Grab your team role here!",
                                       description="Teams are randomized for balance.")
        for role in self.bot.teams:
            role = discord.utils.get(self.bot.current_guild.roles, id=role)
            reaction_embed.add_field(name=role.name, value=f"Number of members: {len(role.members)}")

        await self.bot.react_role_message.edit(content=None, embed=reaction_embed)

    # - Listeners & loops -
    @commands.Cog.listener()  # Unlike on_reaction_add, this will fire 100% of the time. Could also use it but
    async def on_raw_reaction_add(self, payload):  # tbh I just used this as I forgot to pass intents at first

        if payload.user_id in self.reaction_cooldown:  # If user is on cooldown, return
            return                                     # Thoughhhh this isn't needed anymore cos they can't change teams

        member = self.bot.current_guild.get_member(payload.user_id)

        if payload.message_id == self.bot.react_role_message.id:  # This handles giving team roles
            # Load the leaderboard to avoid team switching when already assigned
            with open("leaderboard.json") as leaderboard:
                data = json.load(leaderboard)

            for role in [r.id for r in member.roles]:
                if role in self.bot.teams:
                    return  # User already has role

            # Use pre-stored role id if it exists, else generate randomly
            if str(payload.user_id) in data["roles"]:
                role_id = data["roles"][str(payload.user_id)]
                logging.info(f"Using pre-stored role for {str(member)}")
            else:
                role_id = random.choice(self.bot.teams)
                data["roles"][str(payload.user_id)] = role_id
                logging.info(f"Generating random role for {str(member)}")

            role_obj = discord.utils.get(self.bot.current_guild.roles, id=role_id)
            await member.add_roles(role_obj)
            await self.update_role_message()
            logging.info(f"Added role to {str(member)}")

            self.reaction_cooldown.append(member.id)
            await asyncio.sleep(5)  # Just in case this is abused
            self.reaction_cooldown.remove(member.id)

    @tasks.loop(seconds=random.randint(20, 35))
    async def send_egg_message(self):
        self.send_egg_message.change_interval(seconds=random.randint(20, 35))
        category_id = os.getenv("CATEGORY_ID")
        blacklisted_channels = self.bot.blacklisted_channels
        guild = self.bot.current_guild

        allowed_category = discord.utils.get(guild.categories, id=int(category_id))
        allowed_channels = allowed_category.text_channels
        allowed_channels = list(filter(lambda channel: channel.id not in blacklisted_channels, allowed_channels))

        egg_channel = random.choice(allowed_channels)

        egg_cracked = random.randrange(0, 100) < 30
        eggmoji = "🥚" if not egg_cracked else "🐣"

        try:
            egg_msg = await egg_channel.send(eggmoji)
            await egg_msg.add_reaction(eggmoji)
        except Exception as e:
            logging.error(f"Something went wrong while sending egg message: {e}")
            return

        logging.info(f"Sent {'hatched ' if egg_cracked else ''}egg to {egg_msg.channel}")

        def check(reaction, user):
            return str(reaction.emoji) == eggmoji \
                and reaction.message == egg_msg \
                and not user.bot \
                and any(role in [r.id for r in user.roles] for role in self.bot.teams) \
                and user.id not in self.bot.blacklisted_users
        try:
            reaction, user = await self.bot.wait_for('reaction_add', timeout=10.0, check=check)

        except asyncio.TimeoutError:

            try:
                await egg_msg.delete()
                logging.info("Egg ignored and deleted")

            except:
                logging.warning("Unable to delete egg message")

        else:
            timezone = pytz.timezone(os.getenv("TIMEZONE"))
            timedelta = timezone.localize(datetime.datetime.now()) - egg_msg.created_at
            latency = self.bot.latency if self.bot.latency < 300 else 200
            formatted_timedelta = round((timedelta.total_seconds() - latency) * 1000)

            if not egg_cracked:
                result_msg = await egg_channel.send(content=f"{user.mention} got the egg in {formatted_timedelta} ms!")
            else:
                result_msg = await egg_channel.send(content=f"Uh oh, that egg hatched. {user.mention} lost a point!")

            if formatted_timedelta < 500:  # I don't know if this is realistic but let's see?
                await self.mod_channel.send(f"{str(user)} ({user.id}) got an egg in {formatted_timedelta} ms. Possibly a bot")

            logging.info(f"{user.mention} got the egg in {round(timedelta.total_seconds() * 1000)} ms!")

            await asyncio.sleep(2)

            try:
                await egg_msg.delete()
                await result_msg.delete()
            except:
                logging.warning("Unable to delete egg message")

            self.update_statistics_file(user, user.id, egg_cracked)
            await self.update_leaderboard_message(user)


async def setup(bot):
    await bot.add_cog(EggSpammer(bot))
