const keyboardEvents = {
	0: "MOVE_LEFT",
	ArrowLeft: "MOVE_LEFT",
	a: "MOVE_LEFT",
	2: "READY",
	" ": "READY",
	Enter: "READY",
	4: "MOVE_RIGHT",
	ArrowRight: "MOVE_RIGHT",
	d: "MOVE_RIGHT",
};

const keyboardLabels = {
	left: "◀",
	start: "SPACE",
	right: "▶",
};

function showKeyboardControls() {
	document.querySelectorAll("[data-control]").forEach((label) => {
		label.textContent = keyboardLabels[label.dataset.control];
	});
}

document.addEventListener("keydown", (event) => {
	if (event.target.tagName === "INPUT") return;

	const name = keyboardEvents[event.key.toLowerCase()] || keyboardEvents[event.key];

	if (!name) return;

	event.preventDefault();
	
	showKeyboardControls();

	Connection.receive({ event: name, timestamp: new Date().toISOString() });
});
