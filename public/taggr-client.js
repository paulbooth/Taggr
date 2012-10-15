  var browser_socket = io.connect('http://localhost:8080');
  browser_socket.on('newuid', function (data) {

    console.log("Received a UID! It's " + data.uid);

    // $.post("http://thepaulbooth.com:3727/newuid/" + data.uid);
    $('#connect_tag')
    	.attr('href', "http://thepaulbooth.com:3727/newuid/" + data.uid)
    	.attr('width', 200)
    	.text("Click to activate ID #" + data.uid);
  });

  browser_socket.on('config', function(data) {
  	$('#spot_name').text("Welcome to " + data.spot_name);
  	if (data.spot_image) {
  	  $spot_image = $('<img>');
  	  $spot_image.attr('src', data.spot_image).attr('alt', data.spot_name)
  	  $('#image_div').append($spot_image);
	}
  })

