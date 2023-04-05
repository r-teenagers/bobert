import { Listener } from "@sapphire/framework";
import { BobertClient } from "../lib/client";

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
		const sendEgg = () => {
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
