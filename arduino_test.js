var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var sys = require('sys');
// var arduino_port = "/dev/tty.usbmodemfd121";
var arduino_port = "/dev/tty.usbmodem1421";
var serialPort = new SerialPort(arduino_port, { 
    parser: serialport.parsers.readline("\n") 
  });

var http = require('http');
var connected_to_browser;
var browser_socket;
var trying_to_connect_uid = null; // the fob id that we are trying to connect to
var express = require('express'),
app = express();
var server = http.createServer(app);

var io = require('socket.io').listen(server);
var fs = require('fs');

// for command line things
var childProcess = require('child_process');

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

    var options = {
      host: 'thepaulbooth.com',
      port: 3727,
      path: '/try_check_in/' + encodeURIComponent(uid)
    };
    console.log("making request to /try_check_in/" + encodeURIComponent(uid))
    http.get(options, function(res) {
      var output = '';
      res.on('error', function(e) {
        console.log('ERROR with try_check_in: ' + e.message);
      });

      console.log("try_check_in status:" + res.statusCode);
      // if we were able to check in (fob ID recognized already)
      if (res.statusCode == 200) {
        console.log("Okay, the response means already recognized and made OG post");
      } else if (res.statusCode == 205) {
        // if the fob ID is unrecognized in the DB
        // we must have a new fob that needs linked.

        // If we already have a connection to the browser
        if (connected_to_browser && browser_socket) {

          // Send over the uid!
          browser_socket.emit('newuid', { uid: uid });

          sys.puts("Sending over UID:" + uid);
        }

        else if (!connected_to_browser) {
          sys.puts("Received a new UID but not connected to browser");
          childProcess.exec('open http://thepaulbooth.com:3727', function (error, stdout, stderr) {
            // if (error) {
            //   console.log(error.stack);
            //   console.log('Error code: '+error.code);
            //   console.log('Signal received: '+error.signal);
            // }
            console.log('Chrome done launching.');
            // console.log('Child Process STDERR: '+stderr);
            // var try_to_emit_func = function() {
            //   if (browser_socket) {
            //     browser_socket.emit('newuid', { uid: uid });
            //     console.log("WOO SOCKET");
            //   } else {
            //     console.log("NO SOCKET :(");
            //     setTimeout(try_to_emit_func, 1000);
            //   }
            // };
            trying_to_connect_uid = uid;
            // setTimeout(try_to_emit_func, 1000);
            
          });
        }
        else if (!browser_socket) {
           sys.puts("Received a new UID but socket is nil");
        }
      }
    }); // end of http.get
  }
});

// When we get a connection from the browser
io.sockets.on('connection', function (socket) {

  // Set our global
  connected_to_browser = true;

  sys.puts("We are connected");

  // If there is a socket
  if (socket) {

    // Set our global socket to it for later
    browser_socket = socket;
    if (trying_to_connect_uid) {
      // Send over the uid!
      browser_socket.emit('newuid', { uid: uid });
      trying_to_connect_uid = null;
    }
  }

  socket.on('disconnect', function () {
    console.log("We are disconnect.");
    connected_to_browser = false;
    browser_socket = null;
  });
});

server.listen(8080);