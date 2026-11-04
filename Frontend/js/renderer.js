class Renderer {
	static init(canvas) {
		this.ctx = canvas.getContext("2d");
		this.ctx.imageSmoothingEnabled = false;

		this.width = canvas.width;
		this.height = canvas.height;
		this.pixel = Config.pixelSize;
		this.scroll = 0;
		this.flashTime = 0;
		this.particles = [];
		this.popups = [];
		this.stars = this.createStars(90);
	}

	static snap(value) {
		return Math.round(value / this.pixel) * this.pixel;
	}

	static createStars(count) {
		return Array.from({ length: count }, () => ({
			x: this.snap(Math.random() * this.width),
			y: Math.random() * this.height,
			depth: Shared.randomItem([0.3, 0.6, 1]),
			color: Math.random() < 0.2 ? Shared.randomItem(starColors) : starColors[0],
		}));
	}

	// #region Effects

	static burst(x, y, colors, count = 24) {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 80 + Math.random() * 260;

			this.particles.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0.5 + Math.random() * 0.5,
				color: colors[i % colors.length],
			});
		}
	}

	static popup(x, y, text, color) {
		this.popups.push({ x, y, text, color, life: 0.9 });
	}

	static trail(y) {
		for (let i = 0; i < 3; i++) {
			const offsetX = -this.pixel + (Math.random() - 0.5) * 8;

			this.particles.push({
				offsetX,
				x: Game.ship.x + offsetX,
				y,
				vx: (Math.random() - 0.5) * 20,
				vy: 250 + Math.random() * 200,
				life: 0.2 + Math.random() * 0.2,
				color: Shared.randomItem(boostColors),
			});
		}
	}

	static flash(duration = 0.3) {
		this.flashTime = duration;
	}

	static update(dt, speed) {
		this.scroll += speed * dt;

		for (const star of this.stars) {
			star.y += speed * star.depth * dt;

			if (star.y <= this.height) continue;

			star.y = 0;
			star.x = this.snap(Math.random() * this.width);
		}

		this.particles = this.particles.filter((particle) => {
			if (particle.offsetX === undefined) particle.x += particle.vx * dt;
			else {
				// Eases after the ship, so the trail swings into the new lane
				particle.offsetX += particle.vx * dt;
				particle.x += (Game.ship.x + particle.offsetX - particle.x) * Math.min(1, dt * 10);
			}

			particle.y += particle.vy * dt;
			particle.life -= dt;

			return particle.life > 0;
		});

		this.popups = this.popups.filter((popup) => {
			popup.y -= 60 * dt;
			popup.life -= dt;

			return popup.life > 0;
		});

		this.flashTime = Math.max(0, this.flashTime - dt);
	}

	// #endregion

	// #region Drawing

	static draw(time, highscore) {
		this.drawBackground();
		this.drawStars();
		this.drawLanes();
		this.drawObstacles(time);

		if (Game.state !== "over") this.drawShip(time);

		this.drawParticles();
		this.drawPopups();

		if (Game.state === "play") this.drawScreenHud(highscore);

		this.drawFlash(time);
	}

	static drawBackground() {
		const { ctx } = this;
		const spacing = 64;

		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, this.width, this.height);

		ctx.fillStyle = "rgba(255, 47, 214, 0.18)";

		for (let y = (this.scroll % spacing) - spacing; y < this.height; y += spacing) ctx.fillRect(0, this.snap(y), this.width, this.pixel);
	}

	static drawStars() {
		const { ctx } = this;
		const streaks = Game.state === "play" && Game.speed > Config.baseSpeed * 1.5;

		for (const star of this.stars) {
			const length = streaks && star.depth === 1 ? this.pixel * 3 : this.pixel;

			ctx.globalAlpha = star.depth;
			ctx.fillStyle = star.color;
			ctx.fillRect(star.x, this.snap(star.y), this.pixel, length);
		}

		ctx.globalAlpha = 1;
	}

	static drawLanes() {
		const { ctx } = this;
		const spacing = 48;

		ctx.fillStyle = "rgba(0, 240, 255, 0.35)";

		for (let lane = 1; lane < Config.lanes; lane++) {
			const x = this.snap(Game.laneWidth * lane) - this.pixel / 2;

			for (let y = (this.scroll % spacing) - spacing; y < this.height; y += spacing) ctx.fillRect(x, this.snap(y), this.pixel, 24);
		}
	}

	static drawObstacles(time) {
		const { ctx } = this;

		for (const obstacle of Game.obstacles) {
			const glow = pickupGlow[obstacle.type];
			const x = this.snap(obstacle.x);
			const y = this.snap(glow ? obstacle.y + Math.sin(obstacle.wobble) * 6 : obstacle.y);

			if (glow && Math.floor(time / 150) % 2) {
				const { width, height } = Sprites.size(obstacle.type);

				ctx.fillStyle = glow;
				ctx.fillRect(x - width / 2 - 8, y - height / 2 - 8, width + 16, height + 16);
			}

			Sprites.draw(ctx, obstacle.type, x, y);
		}
	}

	static drawShip(time) {
		const { ship } = Game;

		// Blink while invincible
		if (!Game.boosting && ship.invincible > 0 && Math.floor(time / 80) % 2) return;

		const { offsetX, angle } = this.getBumpMotion(ship);
		const flameY = Sprites.size("ship").height / 2 + Sprites.size("flame").height / 2 - this.pixel;
		const flameFrame = Math.floor(time / 60) % Sprites.frameCount("flame");

		// Drawn around the center of the ship, so it can be rotated
		this.ctx.save();
		this.ctx.translate(this.snap(ship.x + offsetX), this.snap(ship.y));
		this.ctx.rotate(angle);

		if (Game.boosting) {
			this.ctx.fillStyle = Math.floor(time / 100) % 2 ? "rgba(255, 138, 0, 0.35)" : "rgba(255, 230, 0, 0.35)";
			this.ctx.fillRect(-32, -36, 64, 72);
		}

		Sprites.draw(this.ctx, "flame", 0, flameY, flameFrame);
		Sprites.draw(this.ctx, "ship", 0, 0);

		this.ctx.restore();
	}

	// Shake first, then spin once
	static getBumpMotion(ship) {
		if (ship.bump <= 0) return { offsetX: 0, angle: 0 };

		const elapsed = Config.bump.shakeTime + Config.bump.spinTime - ship.bump;

		if (elapsed < Config.bump.shakeTime) return { offsetX: (Math.floor(elapsed * 40) % 2 ? 6 : -6) + ship.bumpDirection * 4, angle: 0 };

		const progress = (elapsed - Config.bump.shakeTime) / Config.bump.spinTime;
		const eased = 1 - (1 - progress) ** 2;

		return { offsetX: 0, angle: -ship.bumpDirection * eased * Math.PI * 2 };
	}

	static drawParticles() {
		const { ctx } = this;
		const size = this.pixel * 2;

		for (const particle of this.particles) {
			ctx.globalAlpha = particle.life > 0.25 ? 1 : 0.5;
			ctx.fillStyle = particle.color;
			ctx.fillRect(this.snap(particle.x), this.snap(particle.y), size, size);
		}

		ctx.globalAlpha = 1;
	}

	static drawPopups() {
		const { ctx } = this;

		ctx.font = '16px "Press Start 2P"';
		ctx.textAlign = "center";

		for (const popup of this.popups) {
			ctx.fillStyle = popup.color;
			ctx.fillText(popup.text, popup.x, this.snap(popup.y));
		}
	}

	static drawText(text, x, y, color, align) {
		this.ctx.textAlign = align;
		this.ctx.fillStyle = color;
		this.ctx.fillText(text, x, y);
	}

	static drawScreenHud(highscore) {
		this.ctx.font = '14px "Press Start 2P"';

		this.drawText("POINT", 16, 30, "#ff2fd6", "left");
		this.drawText(Shared.formatScore(Game.score), 16, 54, "#f4f4ff", "left");
		this.drawText("REKORD", this.width - 16, 30, "#ff2fd6", "right");
		this.drawText(Shared.formatScore(highscore), this.width - 16, 54, "#ffe600", "right");

		for (let i = 0; i < Game.ship.shields; i++) Sprites.draw(this.ctx, "shield", 30 + i * 34, this.height - 30);

		if (!Game.boosting) return;

		this.drawBoostBar();
	}

	// Blinks during the last second
	static drawBoostBar() {
		const remaining = Game.ship.boost / Config.boost.duration;
		const width = 160;
		const x = this.width / 2 - width / 2;

		if (Game.ship.boost < 1 && Math.floor(Game.ship.boost * 8) % 2) return;

		this.drawText("BOOST", this.width / 2, 30, "#ff8a00", "center");

		this.ctx.fillStyle = "#2a1a4a";
		this.ctx.fillRect(x, 42, width, this.pixel * 3);

		this.ctx.fillStyle = "#ffe600";
		this.ctx.fillRect(x, 42, this.snap(width * remaining), this.pixel * 3);
	}

	static drawFlash(time) {
		if (this.flashTime <= 0 || !(Math.floor(time / 50) % 2)) return;

		this.ctx.fillStyle = "rgba(255, 42, 42, 0.35)";
		this.ctx.fillRect(0, 0, this.width, this.height);
	}

	// #endregion
}
