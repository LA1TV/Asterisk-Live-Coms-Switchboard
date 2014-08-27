function addNumEnteredEvent(a) {
	var dispatcher = a;
	var buffer = "";
	var enterPressed = false;
	$(document).keydown(function(e) {
		if (!e.ctrlKey) {
			if (e.keyCode >= 48 && e.keyCode <= 57) { //0-9
				e.preventDefault();
				if (enterPressed) {
					enterPressed = false;
					buffer = "";
				}
				var num = e.keyCode - 48;
				buffer += num.toString();
			}
			else if (e.keyCode === 8 || e.keyCode === 27) { //backspace or esc
				if (buffer != "") {
					e.preventDefault();
					enterPressed = false;
					buffer = "";
				}
			}
			else if (e.keyCode === 13) { //enter
				if (buffer != "") {
					e.preventDefault();
					enterPressed = true;
					dispatcher.trigger("numEntered", parseInt(buffer, 10));
				}
			}
		}
	});
}