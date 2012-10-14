var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var sys = require('sys');
var serialPort = new SerialPort("/dev/tty.usbmodemfd121", { 
    parser: serialport.parsers.readline("\n") 
  });

var http = require('http');
var last_unclaimed_fob;
var connected_to_browser;
var browser_socket;
var express = require('express'),
app = express();
var server = http.createServer(app);

var io = require('socket.io').listen(server);
var fs = require('fs');

app.use("/public", express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');

app.get('/', function(req, res){
  fs.readFile(__dirname + '/taggr.html', 'utf8', function(err, text){
       res.send(text);
   });
});


serialPort.on("data", function (data) {
    sys.puts("here: "+data);

    // The prefix we set before the uid on the arduino end of things
    var prefix = "  UID Value: "; // The prefix before the data we care about comes through

    // If we have a uid calue
    if (data.indexOf(prefix) == 0) {

      // Grab the uid
      uid = data.substring(prefix.length);

      // Save this uid
      last_unclaimed_fob = uid;

      // If we already have a connection to the browser
      if (connected_to_browser && browser_socket) {

        // Send over the uid!
        browser_socket.emit('uid', { uid: last_unclaimed_fob });

        sys.puts("Sending over UID:" + uid);
      }

      else if (!connected_to_browser) {
        sys.puts("Received a UID but not connected to browser");
      }
      else if (!browser_socket) {
         sys.puts("Received a UID but socket is nil");
      }

      // Debug
    	sys.puts("I got some stuff:" + uid);
    }
});


// sends an open graph request with given access_token
function send_open_graph_request(access_token) {
  console.log("making a request with token:" + access_token);
  var options = {
    host: 'thepaulbooth.com',
    port: 3727,
    path: '/tagged_in/' + encodeURIComponent("SCOPE Room") + '?access_token=' + access_token
  };
  http.get(options, function(res) {
    var output = '';
    res.on('data', function (chunk) {
        output += chunk;
    });

    res.on('end', function() {
      console.log("output from OG request:");
      console.log(output);
    });
  }).on('error', function(e) {
    console.log('ERROR: ' + e.message);
    console.log(e);
  });
}

function makeUidRequest(uid) {
  var options = {
    host: 'thepaulbooth.com',
    port: 3727,
    path: '/uid/' + encodeURIComponent(uid)
  };
  http.get(options, function(res) {
    var output = '';
    res.on('data', function (chunk) {
        output += chunk;
    });

    res.on('end', function() {
      console.log("output from UID request:");
      console.log(output);
    });
  }).on('error', function(e) {
    console.log('ERROR: ' + e.message);
    console.log(e);
  });
}

// app.get('/numverified', function(req, res) {
//   res.send(JSON.stringify(verified_users.length));
// });

function request_handler (req, res) {
  // fs.readFile(__dirname + '/index.html',
  // function (err, data) {
  //   if (err) {
  //     res.writeHead(500);
  //     return res.end('Error loading index.html');
  //   }

  //   res.writeHead(200);
  //   res.end(data);
  // });
  res.writeHead(200);
  res.end("lolz");
}

// When we get a connection from the browser
io.sockets.on('connection', function (socket) {

  // Set our global
  connected_to_browser = true;

  sys.puts("We are connected");

  // If there is a socket
  if (socket) {

    // Set our global socket to it for later
    browser_socket = socket;
  }

  // If we already have an unclaimed fob
  if (last_unclaimed_fob) {

      // Send it over
      socket.emit('uid', { uid: last_unclaimed_fob });

        sys.puts("Sent the uid");
  }
});

server.listen(8080);