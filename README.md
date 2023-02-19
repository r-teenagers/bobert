## The EggBot Project

This is a very very simple bot that spams eggs. First one to react to an egg it has sent gets one point. Simple enough.

### Configuration:

You must have a `.env` file in the root directory. Its format is:

```dotenv
TOKEN=
CATEGORY_ID=
GUILD_ID=
AUTHORIZED_USER=
MOD_CHANNEL=
TIMEZONE=
```

Where everything should be ids. For example, CATEGORY_ID=12083246426462 or whatever the id is. Except for token of course.
`TIMEZONE` must be a valid timezone. For example, `America/New_York` or `Europe/Paris`. You can find a list of valid timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

`config.json` stores all relevant message ids and all that fun stuff. Its structure is:

```json
{
  "set": false,
  "teams": [1, 2, 3],
  "blacklisted_users": [0],
  "scoreboard_message": {
    "channel_id": "message_id"
  },
  "react_role_message": {
    "channel_id": "message_id"
  }
}
```

Where teams is a list of integers. Those integers _must_ be valid role ids. Don't touch set.
Blacklisted users is a list of ids you can modify with `<prefix>blacklist [user id]`.

TEAMS MUST BE INSERTED BEFOREHAND. mainly because i'm lazy. after team ids are set, run `<prefix>initialize [channel]`
somewhere. The bot will then send the scoreboard & role messages in the channel and save them.

Smart, I know.

I tried to comment my code but good luck if you're gonna explore it.
