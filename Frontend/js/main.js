async function init() {
	const canvas = document.getElementById("game-canvas");

	Renderer.init(canvas);
	Hud.init();

	let highscore = 0;
	let latestEntry = null;
	let scoreSaved = false;

	Game.init(canvas.width, canvas.height, {
		gameStart() {
			Hud.hideOverlays();

			sendFeedback("gameStart");
		},
		energyCellHit(cell) {
			Renderer.burst(cell.x, cell.y, ["#39ff14", "#f4f4ff"], 18);
			Renderer.popup(cell.x, cell.y, "+50", "#39ff14");

			sendFeedback("energyCellHit", { shields: Game.ship.shields });
		},
		boostActivated(rocket) {
			Renderer.burst(rocket.x, rocket.y, ["#ff8a00", "#ffe600", "#f4f4ff"], 30);
			Renderer.popup(rocket.x, rocket.y, "BOOST!", "#ff8a00");

			sendFeedback("boostActivated");
		},
		obstacleSmashed(obstacle) {
			Renderer.burst(obstacle.x, obstacle.y, ["#ff8a00", "#ffe600", "#ff2a2a"], 24);
			Renderer.popup(obstacle.x, obstacle.y, "+25", "#ffe600");

			sendFeedback("obstacleSmashed");
		},
		boostDeactivated() {
			sendFeedback("boostDeactivated");
		},
		borderHit() {
			sendFeedback("borderHit");
		},
		obstacleHit(obstacle) {
			Renderer.burst(obstacle.x, obstacle.y, ["#ff8a00", "#ffe600", "#ff2a2a"], 30);
			Renderer.flash();

			Hud.shake();

			sendFeedback("obstacleHit", { shields: Game.ship.shields });
		},
		gameOver(finalScore) {
			Renderer.burst(Game.ship.x, Game.ship.y, ["#00f0ff", "#ff2fd6", "#f4f4ff"], 70);
			Renderer.flash();

			Hud.shake();
			Hud.update();

			sendFeedback("gameOver");

			scoreSaved = false;

			Hud.showGameOver(finalScore, finalScore > highscore);
		},
	});

	// #region Backend

	const backendCommands = {
		READY: () => startIfIdle(),
		MOVE_LEFT: () => Game.moveShip(-1),
		MOVE_RIGHT: () => Game.moveShip(1),
	};

	Connection.init({
		onInput: (command) => backendCommands[command]?.(),
		onStatus: (status) => Hud.setConnectionStatus(status),
	});

	// #endregion

	// #region Helpers

	function sendFeedback(event, data) {
		Connection.send(backendEvents[event], data);
	}

	function startIfIdle() {
		if (Game.state === "play") return;

		Game.start();
	}

	async function refreshHighScores() {
		const list = await HighScores.getEntries();

		highscore = list.length > 0 ? list[0].score : 0;

		Hud.setBestScore(highscore);
		Hud.renderHighScores(list, latestEntry);
	}

	async function addToHighScores() {
		if (scoreSaved || Game.state !== "over") return;

		scoreSaved = true;

		const name = Hud.getPlayerName() || "AAAA";

		latestEntry = await HighScores.addEntry(name, Game.score);

		Hud.hideSaveForm();

		await refreshHighScores();
	}

	// #endregion

	// #region Buttons

	document.getElementById("save-form").addEventListener("submit", (event) => {
		event.preventDefault();

		addToHighScores();
	});

	// #endregion

	// #region Startup and game loop

	await Sprites.load().catch((error) => console.error(error));

	Hud.update();

	await refreshHighScores();

	Connection.connect();

	let lastTime = performance.now();

	function loop(time) {
		const dt = Math.min(0.05, (time - lastTime) / 1000);

		lastTime = time;

		Game.update(dt);

		Renderer.update(dt, Game.speed);

		if (Game.state === "play" && Game.boosting) Renderer.trail(Game.ship.y + 26);

		Renderer.draw(time, Math.max(highscore, Game.score));

		if (Game.state === "play") Hud.update();

		requestAnimationFrame(loop);
	}

	requestAnimationFrame(loop);

	// #endregion
}

init();
