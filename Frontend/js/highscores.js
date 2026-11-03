class HighScores {
	static async getEntries() {
		try {
			const response = await fetch(Config.apiUrl);

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			return this.sort(await response.json());
		} catch (error) {
			console.warn("Could not fetch the high scores from the server", error);

			return [];
		}
	}

	static async addEntry(name, score) {
		const entry = { name, score: Math.floor(score) };

		try {
			const response = await fetch(Config.apiUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(entry),
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);
		} catch (error) {
			console.warn("Could not save the score on the server", error);
		}

		return entry;
	}

	static sort(list) {
		return [...list].sort((a, b) => b.score - a.score);
	}
}
