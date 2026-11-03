const Config = {
	lanes: 3,
	startShields: 3,
	maxShields: 5,
	nameLength: 4,
	pixelSize: 4,

	baseSpeed: 320,
	maxSpeedMultiplier: 5,
	speedCurve: 75, // higher = slower speed increase

	invincibleTime: 1.2,
	asteroidChance: 0.65, // otherwise a satellite
	energyCellChance: 0.14,

	waveGap: {
		min: 330,
		random: 140,
	},

	boost: {
		duration: 4,
		speedFactor: 1.7,
		chance: 0.035,
		minTime: 12,
		graceTime: 0.8,
	},

	bump: {
		shakeTime: 0.2,
		spinTime: 0.45,
	},

	apiUrl: "/api/highscores",

	signalR: {
		hubUrl: "/game-hub",
		receiveMethod: "ReceiveArduinoEvent",
		sendMethod: "SendFrontendEvent",
		retryDelay: 5000,
	},
};
