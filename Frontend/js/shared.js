class Shared {
	// 123 -> 000123
	static formatScore(value) {
		return String(Math.floor(value)).padStart(6, "0");
	}

	static randomItem(list) {
		return list[Math.floor(Math.random() * list.length)];
	}

	static clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}
}
