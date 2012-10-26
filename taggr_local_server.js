var config = require('./config')

var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var sys = require('sys');
// var arduino_port = "/dev/tty.usbmodemfd121";
var arduino_port = "/dev/tty.usbmodem1411";
var serialPort = new SerialPort(arduino_port, { 
    parser: serialport.parsers.readline("\n") 
  });

var os = require('os');
var http = require('http');
var connected_to_browser;
var browser_socket;
var trying_to_connect_uid = null; // the fob id that we are trying to connect to
var last_uid_to_connect = null;
var clear_uid_delay = 5000; // amount of time until will allow tag in from same id
var clear_timeout; // clear timeout object itself to allow reset of last tagged in
var express = require('express'),
  app = express();
var server = http.createServer(app);

var io = require('socket.io').listen(server);
var fs = require('fs');

// Going to set a trim function for our strings
if(typeof(String.prototype.trim) === "undefined") {
  String.prototype.trim = function() 
  {
    return String(this).replace(/^\s+|\s+$/g, '');
  };
}

// for command line things
var childProcess = require('child_process');

app.use("/public", express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');

app.get('/', function(req, res){
  fs.readFile(__dirname + '/taggr.html', 'utf8', function(err, text){
       res.send(text);
   });
});

// endpoint to get our config object
app.get('/config', function(req, res) {
  res.send(JSON.stringify(config));
})


serialPort.on("data", function (data) {
  sys.puts("here: "+data);

  // The prefix we set before the uid on the arduino end of things
  var prefix = "  UID Value: "; // The prefix before the data we care about comes through

  // If we have a uid calue
  if (data.indexOf(prefix) == 0) {

    // Grab the uid
    uid = data.substring(prefix.length).trim();

    // If the last uid is still stored (it's stored for 1 seconds) 
    // and the same uid is tagged, don't register it. This is just to
    // prevent repeated taggings. 
    if (uid == last_uid_to_connect) {
      sys.puts("This is a repeat tag. NOT CREATING OG POST");
      set_last_uid_to_connect(uid);
      return;
    }

    var options = {
      host: 'lifegraph.herokuapp.com',
      path: '/try_check_in/' + encodeURIComponent(uid) + "/" + encodeURIComponent(config.spot_name) + "?spot_image=" + encodeURIComponent(config.spot_image)
    };
    console.log("making request to /try_check_in/" + encodeURIComponent(uid) + "/" + encodeURIComponent(config.spot_name))
    http.get(options, function(res) {
      var output = '';
      res.on('error', function(e) {
        console.log('ERROR with try_check_in: ' + e.message);
      });

      console.log("try_check_in status:" + res.statusCode);
      // if we were able to check in (fob ID recognized already)
      if (res.statusCode == 200) {
        console.log("Okay, the response means already recognized and made OG post");
        announce_tag();
        set_last_uid_to_connect(uid);
      } else if (res.statusCode == 205) {
        // if the fob ID is unrecognized in the DB
        // we must have a new fob that needs linked.

        // If we already have a connection to the browser
        if (connected_to_browser && browser_socket) {

          // Send over the uid!
          browser_socket.emit('newuid', { uid: uid });

          set_last_uid_to_connect(uid);

          sys.puts("Sending over UID:" + uid + " okay?");
        }

        else if (!connected_to_browser) {
          sys.puts("Received a new UID but not connected to browser");
          browserCommand = getCorrectBrowserCommand();
          childProcess.exec(browserCommand + ' http://lifegraph.herokuapp.com/login', function (error, stdout, stderr) {

            console.log('Browser done launching.');

            trying_to_connect_uid = uid;
            set_last_uid_to_connect(uid);
            
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
    browser_socket.emit('config', config);
    // if we have a uid waiting to be sent to the browser
    // like, someone already tagged in without a browser open
    if (trying_to_connect_uid) {
      // Send over the uid!
      browser_socket.emit('newuid', { uid: uid});
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

// helper function to get the correct commandline for opening a browser
function getCorrectBrowserCommand() {
  var isWin = !!process.platform.match(/^win/i);
  var isMac = !!process.platform.match(/^darwin/i);
  if (isWin) {
    return 'start';
  } else if (isMac) {
    return 'open';
  } else {
    return 'xdg-open';
  }
}

function getCorrectSpeechCommand() {
  var isWin = !!process.platform.match(/^win/i);
  var isMac = !!process.platform.match(/^darwin/i);
  if (isWin) {
    return '';
  } else if (isMac) {
    return 'say';
  } else {
    return 'espeak';
  }
}

function set_last_uid_to_connect(uid) {
  if (last_uid_to_connect != uid) {
    if (clear_timeout) {
      clearTimeout(clear_timeout);
    }
    clear_timeout = setTimeout(clear_last_uid, clear_uid_delay);
  }
  last_uid_to_connect = uid;
}

function clear_last_uid() {
    last_uid_to_connect = null;
}

function announce_tag() {
  var thing_to_say = "Tagged. " + config.spot_name;
  console.log("saying:" + thing_to_say);
  var say = childProcess.exec('echo "' + thing_to_say + '" | ' + getCorrectSpeechCommand(), function (error, stdout, stderr) {
  });
}

