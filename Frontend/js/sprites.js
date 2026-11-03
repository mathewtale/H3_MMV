class Sprites {
	static definitions = {
		ship: { src: "assets/ship.png", frames: 1 },
		flame: { src: "assets/flame.png", frames: 3 },
		asteroid: { src: "assets/asteroid.png", frames: 1 },
		satellite: { src: "assets/satellite.png", frames: 1 },
		energyCell: { src: "assets/energy-cell.png", frames: 1 },
		rocket: { src: "assets/rocket.png", frames: 1 },
		shield: { src: "assets/shield.png", frames: 1 },
	};

	static images = {};

	static load() {
		const promises = Object.entries(this.definitions).map(([name, { src }]) => this.loadImage(name, src));

		return Promise.all(promises);
	}

	static loadImage(name, src) {
		return new Promise((resolve, reject) => {
			const image = new Image();

			image.onload = () => {
				this.images[name] = image;

				resolve();
			};

			image.onerror = () => reject(new Error(`Could not load ${src}`));

			image.src = src;
		});
	}

	static frameCount(name) {
		return this.definitions[name].frames;
	}

	static size(name) {
		const image = this.images[name];

		if (!image) return { width: 0, height: 0 };

		return { width: image.width / this.frameCount(name), height: image.height };
	}

	static draw(ctx, name, centerX, centerY, frame = 0) {
		const image = this.images[name];

		if (!image) return;

		const { width, height } = this.size(name);

		const x = Math.round(centerX - width / 2);
		const y = Math.round(centerY - height / 2);

		ctx.drawImage(image, frame * width, 0, width, height, x, y, width, height);
	}
}
