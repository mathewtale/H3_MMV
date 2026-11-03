class Connection {
	static init({ onInput, onStatus }) {
		this.onInput = onInput;
		this.onStatus = onStatus;
	}

	static get isConnected() {
		return this.hub?.state === "Connected";
	}

	static connect() {
		this.hub = new signalR.HubConnectionBuilder()
			.withUrl(Config.signalR.hubUrl, { skipNegotiation: true, transport: signalR.HttpTransportType.WebSockets })
			.withAutomaticReconnect()
			.configureLogging(signalR.LogLevel.Warning)
			.build();

		this.hub.on(Config.signalR.receiveMethod, (message) => this.receive(message));
		this.hub.onreconnecting(() => this.onStatus("lost"));
		this.hub.onreconnected(() => this.onStatus("online"));
		this.hub.onclose(() => this.retry());

		this.start();
	}

	static async start() {
		this.onStatus("connecting");

		try {
			await this.hub.start();

			this.onStatus("online");
		} catch (error) {
			console.warn("Could not connect to the backend", error);

			this.retry();
		}
	}

	static retry() {
		this.onStatus("lost");

		setTimeout(() => this.start(), Config.signalR.retryDelay);
	}

	static receive(message) {
		console.log("Received", message);

		this.onInput(message.event);
	}

	static send(event, data) {
		if (!this.isConnected) return;

		const message = { event, data, timestamp: new Date().toISOString() };

		console.log("Sent", message);

		this.hub.send(Config.signalR.sendMethod, message);
	}
}
