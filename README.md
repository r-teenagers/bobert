## The EggBot Project

This is a very very simple bot that spams eggs. First one to react to an egg it has sent gets one point. Simple enough.

### Running:
Run `bun install` to install all dependencies.
Copy the contents of `config.example.toml` to `config.toml` and fill in the values.
Run `bun start` to run, or `bun dev` to watch for changes. A SQLite database for scoring will be created in the project directory.

### Configuration:

You must have a `config.toml` file in the root directory. Its format is given in `config.example.toml`.

The first time the bot is run, it will send the embeds in the server and channel given in `config.toml`.
It will autofill some properties in the config file. **DO NOT CHANGE THEM UNLESS YOU KNOW WHAT YOU'RE DOING.**
