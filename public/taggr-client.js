  var browser_socket = io.connect('http://localhost:8080');
  browser_socket.on('newuid', function (data) {

    console.log("Received a UID! It's " + data.uid);

    // $.post("http://thepaulbooth.com:3727/newuid/" + data.uid);
    window.location = "http://thepaulbooth.com:3727/newuid/" + data.uid;

  });

