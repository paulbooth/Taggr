var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var sys = require('sys');
var serialPort = new SerialPort("/dev/tty.usbmodem1421", { 
    parser: serialport.parsers.readline("\n") 
  });

var http = require('http');

serialPort.on("data", function (data) {
    sys.puts("here: "+data);
    var prefix = "  UID Value: "; // The prefix before the data we care about comes through
    if (data.indexOf(prefix) == 0) {
      uid = data.substring(prefix.length);
    	sys.puts("I got some stuff:" + uid);
      makeUidRequest(uid);
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