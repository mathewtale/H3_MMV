class Game {
	static init(width, height, events = {}) {
		this.width = width;
		this.height = height;
		this.laneWidth = width / Config.lanes;
		this.events = events;
		this.state = "menu";

		this.reset();
	}

	static get boosting() {
		return this.ship.boost > 0;
	}

	static get speed() {
		if (this.state !== "play") return Config.baseSpeed * 0.5;

		return Config.baseSpeed * this.speedMultiplier * (this.boosting ? Config.boost.speedFactor : 1);
	}

	static laneX(lane) {
		return this.laneWidth * lane + this.laneWidth / 2;
	}

	static reset() {
		this.ship = { lane: 1, x: this.laneX(1), y: this.height - 110, shields: Config.startShields, invincible: 0, boost: 0, bump: 0, bumpDirection: 0 };
		this.obstacles = [];
		this.score = 0;
		this.distance = 0;
		this.speedMultiplier = 1;
		this.elapsed = 0;
		this.spawnTimer = 0.8;
		this.lastFreeLane = null;
	}

	static start() {
		this.reset();

		this.state = "play";

		this.emit("gameStart");
	}

	static moveShip(direction) {
		if (this.state !== "play") return;

		const lane = Shared.clamp(this.ship.lane + direction, 0, Config.lanes - 1);

		if (lane !== this.ship.lane) {
			this.ship.lane = lane;

			return;
		}

		// Bump into the edge if already in the outer lane
		if (this.ship.bump > 0) return;

		this.ship.bump = Config.bump.shakeTime + Config.bump.spinTime;
		this.ship.bumpDirection = direction;

		this.emit("borderHit");
	}

	// #region Update

	static update(dt) {
		if (this.state !== "play") return;

		this.elapsed += dt;

		this.speedMultiplier = 1 + (Config.maxSpeedMultiplier - 1) * (1 - Math.exp(-this.elapsed / Config.speedCurve));

		this.distance += (this.speed * dt) / 1000;
		this.score += dt * 10 * this.speedMultiplier * (this.boosting ? 2 : 1);

		this.updateSpawning(dt);
		this.updateShip(dt);
		this.updateObstacles(dt);
	}

	static updateSpawning(dt) {
		this.spawnTimer -= dt;

		if (this.spawnTimer > 0) return;

		this.spawnWave();

		this.spawnTimer = (Config.waveGap.min + Math.random() * Config.waveGap.random) / this.speed;
	}

	static updateShip(dt) {
		// Faster lane switching at higher speed
		this.ship.x += (this.laneX(this.ship.lane) - this.ship.x) * Math.min(1, dt * (14 + this.speedMultiplier * 6));

		if (this.ship.invincible > 0) this.ship.invincible -= dt;

		this.ship.bump = Math.max(0, this.ship.bump - dt);

		if (!this.boosting) return;

		this.ship.boost -= dt;

		if (this.boosting) return;

		this.ship.boost = 0;
		this.ship.invincible = Config.boost.graceTime;

		this.emit("boostDeactivated");
	}

	static updateObstacles(dt) {
		for (let i = this.obstacles.length - 1; i >= 0; i--) {
			const obstacle = this.obstacles[i];

			obstacle.y += this.speed * dt;
			obstacle.wobble += dt * 4;

			// Bonus for dodging
			if (obstacle.y - 40 > this.height) {
				if (!pickups.includes(obstacle.type)) this.score += 5;

				this.obstacles.splice(i, 1);

				continue;
			}

			if (!this.collides(obstacle)) continue;

			this.handleCollision(obstacle, i);

			if (this.state !== "play") return;
		}
	}

	// #endregion

	// #region Collisions

	static collides(obstacle) {
		const distance = Math.hypot(obstacle.x - this.ship.x, obstacle.y - this.ship.y);

		return distance < hitboxRadius[obstacle.type] + hitboxRadius.ship;
	}

	static handleCollision(obstacle, index) {
		// Obstacles fly through the ship while it is invincible
		if (!pickups.includes(obstacle.type) && !this.boosting && this.ship.invincible > 0) return;

		this.obstacles.splice(index, 1);

		if (obstacle.type === "energyCell") {
			this.ship.shields = Math.min(Config.maxShields, this.ship.shields + 1);
			this.score += 50;

			return this.emit("energyCellHit", obstacle);
		}

		if (obstacle.type === "rocket") {
			this.ship.boost = Config.boost.duration;
			this.score += 100;

			return this.emit("boostActivated", obstacle);
		}

		// While boosting everything gets smashed
		if (this.boosting) {
			this.score += 25;

			return this.emit("obstacleSmashed", obstacle);
		}

		this.ship.shields--;
		this.ship.invincible = Config.invincibleTime;

		if (this.ship.shields > 0) return this.emit("obstacleHit", obstacle);

		this.state = "over";

		this.emit("gameOver", Math.floor(this.score));
	}

	// #endregion

	// #region Spawning

	// With two obstacles the free lane is next to the last free lane, so it can always be reached.
	static spawnWave() {
		const doubleChance = Math.min(0.6, (this.speedMultiplier - 1.4) * 0.3);
		const blockedLanes = Math.random() < doubleChance ? this.pickDoubleLanes() : [this.randomLane()];
		const freeLanes = [0, 1, 2].filter((lane) => !blockedLanes.includes(lane));
		const freeLane = Shared.randomItem(freeLanes);

		this.lastFreeLane = blockedLanes.length === 2 ? freeLanes[0] : null;

		for (const lane of blockedLanes) this.obstacles.push(this.createObstacle(Math.random() < Config.asteroidChance ? "asteroid" : "satellite", lane));

		if (this.canSpawnRocket()) return this.obstacles.push(this.createObstacle("rocket", freeLane, -180));

		if (Math.random() >= Config.energyCellChance) return;

		this.obstacles.push(this.createObstacle("energyCell", freeLane, -180));
	}

	static pickDoubleLanes() {
		const reachable = [0, 1, 2].filter((lane) => this.lastFreeLane === null || Math.abs(lane - this.lastFreeLane) <= 1);
		const freeLane = Shared.randomItem(reachable);

		return [0, 1, 2].filter((lane) => lane !== freeLane);
	}

	static randomLane() {
		return Math.floor(Math.random() * Config.lanes);
	}

	static canSpawnRocket() {
		if (this.elapsed < Config.boost.minTime || this.boosting) return false;

		if (this.obstacles.some((obstacle) => obstacle.type === "rocket")) return false;

		return Math.random() < Config.boost.chance;
	}

	static createObstacle(type, lane, offsetY = 0) {
		return { type, x: this.laneX(lane), y: -60 + offsetY, wobble: Math.random() * Math.PI * 2 };
	}

	// #endregion

	static emit(eventName, ...args) {
		this.events[eventName]?.(...args);
	}
}
