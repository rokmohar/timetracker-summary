function fetchTimeRecords(jwt, fromDate, untilDate) {
	var fromISO = moment(fromDate).startOf('day').toISOString();
	var untilISO = moment(untilDate).endOf('day').toISOString();
	
	if (!fromISO || !untilISO) {
		alert("From date or Until date is wrong.");
		return;
	}
	if (untilISO < fromISO) {
		alert("Until date is after From date.");
		return;
	}
	
	return fetch(
		'https://my.easy.bi/restapi/v2/time-tracker/timeRecord/by-me-notBefore-notAfter/' + fromISO + '/' + untilISO + '?refs=userProjectRole.projectRole.project',
		{ headers: { 'Content-type': 'application/json', 'x-access-token': jwt } }
	)
	.then(async (response) => {
		if (response.status != 200) {
			throw new Error("Response does not have the expected status code.");
		}
		return response.json();
	})
	.then((body) => {
		const groups = {
			byDateAndProject: {},
			byProject: {},
			byDate: {},
		};
		body.forEach((t) => {
			const projectName = t.userProjectRole.projectRole.project.name;
			const startedAt = moment(t.startedAt).format("YYYY-MM-DD");
			const duration = Math.floor(((Math.abs(new Date(t.finishedAt) - new Date(t.startedAt))) / 1000) / 60) / 60;
			
			if (!groups.byDateAndProject[startedAt]) {
				groups.byDateAndProject[startedAt] = {};
			}
			if (!groups.byDateAndProject[startedAt][projectName]) {
				groups.byDateAndProject[startedAt][projectName] = 0;
			}
			if (!groups.byProject[projectName]) {
				groups.byProject[projectName] = 0;
			}
			if (!groups.byDate[startedAt]) {
				groups.byDate[startedAt] = 0;
			}
			
			groups.byDateAndProject[startedAt][projectName] += duration;
			groups.byProject[projectName] += duration;
			groups.byDate[startedAt] += duration;
		});
		return groups;
	});
}

function submitForm(event) {
	event.stopPropagation();
	event.preventDefault();
	
	var jwt = $("#jwt").val();
	var fromDate = $("#from-date").val();
	var untilDate = $("#until-date").val();
	
	console.log("jwt:", jwt);
	console.log("fromDate:", fromDate);
	console.log("untilDate:", untilDate);
	
	if (!jwt || !fromDate || !untilDate) {
		return;
	}
	
	var $showSummary = $("#show-summary");
	$showSummary.hide();

	var $totalSum = $("#total-sum");
	$totalSum.html("");
	
	var $totalListing = $("#total-listing");
	$totalListing.html("");
	
	var $byDateListing = $("#byDate-listing");
	$byDateListing.html("");
	
	fetchTimeRecords(jwt, fromDate, untilDate)
		.then((groups) => {
			console.log("Time Records:", groups);
			
			$showSummary.show();
			
			var totalSum = 0;
			
			Object.entries(groups.byProject).sort(([, at], [, bt]) => bt - at).forEach(([pl, pt]) => {
				$totalListing.append($("<li>").text(pl + ": " + pt.toFixed(2)));
				totalSum += pt;
			});
			
			$totalSum.html(totalSum.toFixed(2));
			
			Object.entries(groups.byDate).sort(([al], [bl]) => bl - al).forEach(([dl, dt]) => {
				const $listingItem = $("<li>");
				
				$byDateListing.append($listingItem);
				$listingItem.append($("<h3>").text(dl + " (" + dt.toFixed(2) + ")"));
				
				const $byProjectListing = $("<ul>");
				const groupForDate = groups.byDateAndProject[dl];
				
				Object.entries(groupForDate).sort(([, at], [, bt]) => bt - at).forEach(([pl, pt]) => {
					$byProjectListing.append($("<li>").text(pl + ": " + pt.toFixed(2)));
				});
				
				$listingItem.append($byProjectListing);
			});
		})
		.catch(() => alert("Failed to export TimeTracker. Try to refresh JWT."));

	return false;
}

function loadJwtFromStorage(cb) {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		chrome.tabs.executeScript(tabs[0].id, { code: `localStorage.getItem('easy.bi_token')` }, function(response) {
			try {
				cb(JSON.parse(response[0]));
			} catch (error) {
				alert("Failed to load tokens from storage.");
			}
		});
	});
}

function saveJwtToStorage(tokens) {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		chrome.tabs.executeScript(tabs[0].id, {code: `localStorage.setItem('easy.bi_token', '${JSON.stringify(tokens)}')`}, function (response) {
			$("#jwt").val(tokens.authToken);
		});
	});
}

function refreshJwt() {
	loadJwtFromStorage(function(tokens) {
		return fetch(
			'https://my.easy.bi/loginapi/v1/loginReset',
			{ method: 'POST', headers: { 'Content-type': 'application/json' }, body: JSON.stringify({ jwt: tokens.authToken, resetToken: tokens.resetToken }) }
		).then((response) => {
			if (response.status != 200) {
				throw new Error("Response does not have the expected status code.");
			}
			return response.json();
		}).then((newTokens) => {
			console.log("New Tokens:", newTokens);
			saveJwtToStorage(newTokens);
		}).catch(() => alert("Failed to refresh JWT. Are you logged in?"));
	});
}

$(document).ready(function() {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		if (!tabs[0].url.startsWith("https://my.easy.bi")) {
			return;
		}

		const $fromDate = $("#from-date");
		const $untilDate = $("#until-date");
		const $domainMsg = $("#domain-msg");
		const $exportForm = $("#export-form");
		const $refreshBtn = $("#refresh-btn");
		
		$fromDate.val(moment().startOf("month").format("YYYY-MM-DD"));
		$untilDate.val(moment().endOf("month").format("YYYY-MM-DD"));
		$exportForm.on("submit", submitForm);
		$refreshBtn.on("click", refreshJwt);
		
		$domainMsg.hide();
		$exportForm.show();

		loadJwtFromStorage(function (tokens) {
			$("#jwt").val(tokens.authToken);
		});
	});
});
