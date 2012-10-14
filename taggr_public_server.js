// door tracker
// var apiKey = '423298101062880';
// var secretKey = '3ea916ceaa6675538845a6ad37268692';

//taggr
var apiKey = '162309810576217';
var secretKey = 'cfcce3d3e6a2cec6bae74c90b9ca3387';

var argv = process.argv;
var https = require('https');
var querystring = require('querystring');

var hostUrl = 'http://thepaulbooth.com:3727';

var express = require('express'),
    app = express();

var mongo = require('mongodb'),
  Server = mongo.Server,
  Connection = mongo.Connection,
  Db = mongo.Db;
var mongo_host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var mongo_port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("Connecting to " + mongo_host + ":" + mongo_port);
var db = new Db('taggrdb', new Server(mongo_host, mongo_port, {}), {safe:false});

var verified_users = [];
// For cookies! So each person who connects is not all the same person
var MemoryStore = require('connect').session.MemoryStore;
app.use(express.cookieParser());
app.use(express.session({ secret: "taggr", store: new MemoryStore({ reapInterval:  60000 * 10 })}));

app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// First part of Facebook auth dance
app.get('/', function(req, res){
  var redirect_url = 'https://www.facebook.com/dialog/oauth?client_id=' + apiKey +
   '&redirect_uri=' + hostUrl + '/perms' +
   '&scope=publish_actions&state=authed'
  // console.log("REDIRECTIN' From /")
  // console.log(redirect_url);
  // console.log("REQUEST HEADERS:" + JSON.stringify(req.headers));
  res.redirect(redirect_url);
});

// Second part of Facebook auth dance
app.get('/perms', function(req, res){
  var state = req.query['state'];
  var code = req.query['code'];
  // console.log("req.query:" + JSON.stringify(req.query))
  // console.log("hit /perms")
  // console.log("Code:");
  // console.log(code);
  if (state == 'authed') {
    console.log('sick. Facebook PERMED us.')
    var redirect_path = '/oauth/access_token?' +
    'client_id=' + apiKey +
    '&redirect_uri=' + hostUrl + '/perms' +
    '&client_secret=' + secretKey +
    '&code=' + code;// + '&destination=chat';
    var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: redirect_path
    };

    https.get(options, function(fbres) {
      // console.log('STATUS: ' + fbres.statusCode);
      // console.log('HEADERS: ' + JSON.stringify(fbres.headers));
      var output = '';
      fbres.on('data', function (chunk) {
          output += chunk;
      });

      fbres.on('end', function() {
        console.log("ACCESS TOKEN RIGHT HERE");
        console.log(output);
        // parse the text to get the access token
        req.session.access_token = output.replace(/access_token=/,"").replace(/&expires=\d+$/, "");

        // console.log("ACCESS TOKEN:" + access_token)
        res.redirect('/basicinfo');
      });
    }).on('error', function(e) {
      console.log('ERROR: ' + e.message);
    });
  } else {
    console.error("WHAT THE HECK WE AREN'T AUTHED?????? %s", state);
  }
});

// Gets the basic user info
app.get('/basicinfo', function(req, res) {
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT Basic info.")
    res.redirect('/'); // go home to start the auth process again
    return;
  }
  var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: '/me?access_token=' + req.session.access_token
    };
  https.get(options, function(fbres) {
    // console.log('CHATSTATUS: ' + fbres.statusCode);
    //   console.log('HEADERS: ' + JSON.stringify(fbres.headers));

      var output = '';
      fbres.on('data', function (chunk) {
          //console.log("CHUNK:" + chunk);
          output += chunk;
      });

      fbres.on('end', function() {
        req.session.user = JSON.parse(output);
        res.redirect('/taggr');
      });
  });
});

// The page for taggr
app.get('/taggr', function(req, res) {
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT Taggr.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  var locals = {name: req.session.user.name, verified: check_verified(req.session.user.id)}
  console.log("user:")
  console.log(JSON.stringify(req.session.user, undefined, 2));
  console.log(req.session.access_token);
  res.render('index.jade', locals);
  //res.send("CHATTING IT UP, " + my_user.name + ", with: <ul><li>" + ONLINE.join('</li><li>') + '</li></ul>');
});

// when someone walks into a room, this posts to the FB timeline
app.get('/personwalkedinto/:room_name', function(req, res) {
  console.log("Hey someone walked!");
  var user_id = req.query["user_id"];
  var entering_room = req.query["entering_room"];
  var room_image = req.query["room_image"] || 'http://www.classcarpetny.com/wp-content/uploads/2012/03/room.jpg'
  console.log("entering room:" + entering_room);
  console.log(typeof(entering_room));
  if (!req.session.access_token && (user_id == null || verified_users.length == 0)) {
    console.log("NO ACCESS TOKEN AT PERSON WALKED.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  var access_token = req.session.access_token || verified_users[user_id % verified_users.length].access_token;
  var room_name = req.params.room_name;
  console.log("ROOM NAME:" + room_name);
  // we are going to handle the person walking now

  var post_data = querystring.stringify({
    room: "http://thepaulbooth.com:3727/room/" + room_name + '?room_image='+room_image,
    access_token: access_token
  });

  var action_type = (entering_room == 'false') ? 'leave' : 'enter';
  var options = {
    host: 'graph.facebook.com',
    headers: {
      'Content-Length': post_data.length,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'POST',
    path: '/me/doortracker:' + action_type + '?access_token=' + access_token
  };

  var request = https.request(options, function (response) {
    var str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      console.log(str);
      res.send(str);
    });
  });
  request.write(post_data);
  request.end();  
});

// checks to see if a fbid is stored already
function check_verified(fbid) {
  for (var i = 0; i < verified_users.length; i++) {
    if (verified_users[i].user.id == fbid) {
      return true;
    }
  }
  return false;
}

// stores the info of the current person as a verified user
app.post('/store_info', function (req, res) {
  console.log("STORING INFO:" + req.session.user.name);
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT store_info.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  verified_users.push({user: req.session.user,  access_token:req.session.access_token});
  res.redirect('/');
});

// removes the info of the current person as a verified user
app.post('/remove_info', function (req, res) {
  console.log("Removing INFO:" + req.session.user.name);
  if (!req.session.access_token) {
    console.log("NO ACCESS TOKEN AT store_info.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  for (var i = 0; i < verified_users.length; i++) {
    if (verified_users[i].user.id == req.session.user.id) {
      //verified_users.splice(i,1);
      // if we splice, it will mess up everybody's stuff.
      // we should set this to null, check for null everywhere
      // and have a server-side endpoint for cycling the laptop vid
      i--;
    }
  }
  res.redirect('/');
});

// gets infor on the the next user object for the given current vid
app.get('/next/:vid', function(req, res) {
  vid = parseInt(req.params.vid);
  nvid = vid + 1;
  if (verified_users.length > 0) {
    while (verified_users[nvid] == null) {
      nvid++;
      if (nvid > verified_users.length) {
        nvid = 0;
      }
      if (nvid == vid) {
        // no users found. :(
        if (verified_users[vid]) {
          break;
        }
        res.send(JSON.stringify({vid: 0, user: null}));
        return;
      }
    }
    res.send(JSON.stringify({ user:verified_users[nvid].user, vid: nvid }));
  } else {
    res.send(JSON.stringify({vid: 0, user: null}));
  }
});

// gets the number of verified users
app.get('/numverified', function(req, res) {
  res.send(JSON.stringify(verified_users.length));
});

// url to get a specific room
// each room is an open graph object page
// /room?room_name=Suite400
app.get('/room/:room_name', function(req, res) {
  var room_name = req.params.room_name;
  var room_image = req.query["room_image"] || 'http://www.classcarpetny.com/wp-content/uploads/2012/03/room.jpg';
  res.render('room.jade', {room_name: room_name, room_image: room_image});
});


app.get('/uid/:uid', function(req, res) {
  var uid = req.params.uid;
  // mongo.find('uids', {uid: uid}, function(results) {
  //   console.log(results); // false if not found
  //   res.send(results);
  // });
});

console.log("starting server");
app.listen(3727);

db.open(function(err, db) {
  db.dropDatabase(function(err, result) {
    db.collection('test', function(err, collection) {      
      // Erase all records from the collection, if any
      collection.remove({}, function(err, result) {
        // Insert 3 records
        for(var i = 0; i < 2; i++) {
          collection.insert({'a':i});
        }
        
        collection.count(function(err, count) {
          console.log("There are " + count + " records in the test collection. Here they are:");

          collection.find(function(err, cursor) {
            cursor.each(function(err, item) {
              if(item != null) {
                console.dir(item);
                console.log("created at " + new Date(item._id.generationTime) + "\n")
              }
              // Null signifies end of iterator
              if(item == null) {                
                // Destory the collection
                collection.drop(function(err, collection) {
                  db.close();
                });
              }
            });
          });          
        });
      });      
    });
  });
});
console.log("that was cool");