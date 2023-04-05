import { Listener } from "@sapphire/framework";
import { BobertClient } from "../lib/client";

export class ReadyListener extends Listener {
	public constructor(context: Listener.Context, options: Listener.Options) {
		super(context, {
			...options,
			once: true,
			event: "ready",
		});
	}

	public run(client: BobertClient) {
		client.startEggs();
	}
}
