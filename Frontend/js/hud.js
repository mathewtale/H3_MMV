class Hud {
	static init() {
		this.elements = {
			score: document.getElementById("hud-score"),
			best: document.getElementById("hud-best"),
			shields: document.getElementById("hud-shields"),
			speed: document.getElementById("hud-speed"),
			speedBar: document.getElementById("hud-speed-bar"),
			distance: document.getElementById("hud-distance"),
			screen: document.getElementById("screen"),
			startScreen: document.getElementById("start-screen"),
			gameOverScreen: document.getElementById("game-over-screen"),
			connectionLostScreen: document.getElementById("connection-lost-screen"),
			finalScore: document.getElementById("final-score"),
			newRecord: document.getElementById("new-record"),
			saveForm: document.getElementById("save-form"),
			playerName: document.getElementById("player-name"),
			highScores: document.getElementById("highscores"),
			connectionDot: document.getElementById("connection-dot"),
			connectionText: document.getElementById("connection-text"),
		};

		this.shieldIcons = this.createShieldIcons();
		this.speedSegments = this.createSpeedSegments();

		this.elements.playerName.addEventListener("input", (event) => {
			event.target.value = event.target.value.toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, "");
		});

		this.elements.screen.addEventListener("animationend", () => this.elements.screen.classList.remove("animate-shake"));
	}

	// #region Pilot status

	static createShieldIcons() {
		const icons = [];

		for (let i = 0; i < Config.maxShields; i++) {
			const icon = document.createElement("img");

			icon.src = "assets/shield.png";
			icon.alt = "";
			icon.className = "size-5.25 pixelated";

			icons.push(icon);
		}

		this.elements.shields.replaceChildren(...icons);

		return icons;
	}

	static createSpeedSegments() {
		const segments = [];

		for (let i = 0; i < speedColors.length; i++) segments.push(document.createElement("i"));

		this.elements.speedBar.replaceChildren(...segments);

		return segments;
	}

	static update() {
		this.elements.score.textContent = Shared.formatScore(Game.score);
		this.elements.speed.textContent = Game.speedMultiplier.toFixed(1) + "X";
		this.elements.distance.textContent = Game.distance.toFixed(1) + "KM";

		this.shieldIcons.forEach((icon, i) => {
			icon.classList.toggle("grayscale", i >= Game.ship.shields);
			icon.classList.toggle("brightness-35", i >= Game.ship.shields);
		});

		const progress = (Game.speedMultiplier - 1) / (Config.maxSpeedMultiplier - 1);
		const active = Math.round(progress * (speedColors.length - 1)) + 1;

		this.speedSegments.forEach((segment, i) => {
			segment.className = "h-3.5 w-3 " + (i < active ? speedColors[i] : "bg-void");
		});
	}

	static setBestScore(score) {
		this.elements.best.textContent = Shared.formatScore(score);
	}

	static shake() {
		this.elements.screen.classList.add("animate-shake");
	}

	// #endregion

	// #region Overlays

	static hideOverlays() {
		this.elements.startScreen.hidden = true;
		this.elements.gameOverScreen.hidden = true;
		this.elements.connectionLostScreen.hidden = true;
	}

	static showConnectionLost() {
		this.elements.connectionLostScreen.hidden = false;
	}

	static showGameOver(score, isNewRecord) {
		this.elements.finalScore.textContent = Shared.formatScore(score);
		this.elements.newRecord.hidden = !isNewRecord;
		this.elements.saveForm.hidden = false;
		this.elements.playerName.value = "";
		this.elements.gameOverScreen.hidden = false;

		setTimeout(() => this.elements.playerName.focus(), 50);
	}

	static hideSaveForm() {
		this.elements.saveForm.hidden = true;
	}

	static getPlayerName() {
		return this.elements.playerName.value.trim().toUpperCase().slice(0, Config.nameLength);
	}

	// #endregion

	// #region High scores

	// The new entry blinks green
	static renderHighScores(list, latestEntry) {
		const container = this.elements.highScores;

		if (list.length === 0) {
			const empty = document.createElement("p");

			empty.className = "whitespace-pre-line text-center text-label leading-loose text-dim";
			empty.textContent = "INGEN POINT\nENDNU\n\nBLIV DEN\nFØRSTE!";

			return container.replaceChildren(empty);
		}

		const table = document.createElement("table");
		const header = table.insertRow();

		table.className = "w-full border-collapse text-body";

		for (const title of ["NR", "NAVN", "POINT"]) {
			const th = document.createElement("th");

			th.className = "pb-3 text-left text-tiny font-normal text-neon-cyan last:text-right";
			th.textContent = title;

			header.appendChild(th);
		}

		const latestIndex = list.findIndex((entry) => entry.name === latestEntry?.name && entry.score === latestEntry?.score);

		list.forEach((entry, index) => {
			const row = table.insertRow();
			const isLatest = index === latestIndex;
			const color = isLatest ? "text-neon-green animate-blink-short" : rankColors[index] || "text-dim";

			for (const value of [`${index + 1}.`, entry.name, Shared.formatScore(entry.score)]) {
				const cell = row.insertCell();

				cell.className = `py-1.75 last:text-right ${color}`;
				cell.textContent = value;
			}
		});

		container.replaceChildren(table);
	}

	// #endregion

	// #region Backend

	static setConnectionStatus(status) {
		const isOnline = status === "online";
		const dot = this.elements.connectionDot;

		dot.classList.toggle("bg-neon-green", isOnline);
		dot.classList.toggle("shadow-glow-green", isOnline);
		dot.classList.toggle("bg-neon-red", !isOnline);
		dot.classList.toggle("shadow-glow-red", !isOnline);

		this.elements.connectionText.textContent = connectionText[status];
	}

	// #endregion
}
