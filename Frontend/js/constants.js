const backendEvents = {
	gameStart: "GAME_START",
	energyCellHit: "ENERGY_CELL_HIT",
	boostActivated: "BOOST_ACTIVATED",
	boostDeactivated: "BOOST_DEACTIVATED",
	obstacleSmashed: "OBSTACLE_SMASHED",
	borderHit: "BORDER_HIT",
	obstacleHit: "OBSTACLE_HIT",
	gameOver: "GAME_OVER",
};

const hitboxRadius = { ship: 18, asteroid: 22, satellite: 22, energyCell: 18, rocket: 20 };
const pickups = ["energyCell", "rocket"];

const starColors = ["#ffffff", "#00f0ff", "#ff2fd6", "#ffe600"];
const boostColors = ["#ff8a00", "#ffe600", "#ff2a2a"];
const pickupGlow = { energyCell: "rgba(57, 255, 20, 0.25)", rocket: "rgba(255, 138, 0, 0.3)" };

const connectionText = {
	connecting: "FORBINDER...",
	online: "SERVER ONLINE",
	lost: "FORBINDELSE TABT...",
};
const rankColors = ["text-neon-yellow", "text-light", "text-neon-orange"];
const speedColors = ["bg-neon-green", "bg-neon-green", "bg-neon-green", "bg-neon-green", "bg-neon-yellow", "bg-neon-yellow", "bg-neon-yellow", "bg-neon-red", "bg-neon-red", "bg-neon-red"];
