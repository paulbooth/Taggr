function countdown() {
	var timeleft = parseInt($('#countdown').text());
	$('#countdown').text(timeleft-1);
	if (timeleft <= 1) {
		window.location = '../logout';
	} else {
		setTimeout(countdown, 1000);
	}
}

$(function(){
	countdown();
})