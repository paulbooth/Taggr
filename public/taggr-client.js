  var browser_socket = io.connect('http://localhost');
  browser_socket.on('uid', function (data) {

    alert("Received a UID! It's " + data.uid);

    // $.post("http://thepaulbooth.com:3727/newuid/" + data.uid);
    window.location = "http://thepaulbooth.com:3727/newuid/" + data.uid;

  });

