function sendLoginReset(tokens) {
	return fetch(
		'https://my.easy.bi/loginapi/v1/loginReset',
		{ method: 'POST', headers: { 'Content-type': 'application/json' }, body: JSON.stringify({ jwt: tokens.authToken, resetToken: tokens.resetToken }) }
	)
	.then((response) => {
		if (response.status != 200) {
			throw new Error("Response does not have expected status code.");
		}
		return response.json();
	})
	.then((newTokens) => {
		console.log("New Tokens:", newTokens);
		localStorage.setItem("easy.bi_token", JSON.stringify(newTokens));
	});
}

(function() {
	try {
		const tokens = JSON.parse(localStorage.getItem("easy.bi_token"));
		sendLoginReset(tokens);
	} catch (e) {
		// Failed to load JWT from storage
	}
})();
