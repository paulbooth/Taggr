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
      console.log(redirect_path);
      console.log(JSON.stringify(e, undefined, 2))
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
  var locals = {name: req.session.user.name}
  // console.log("user:")
  // console.log(JSON.stringify(req.session.user, undefined, 2));
  // console.log(req.session.access_token);
  res.render('index.jade', locals);
  //res.send("CHATTING IT UP, " + my_user.name + ", with: <ul><li>" + ONLINE.join('</li><li>') + '</li></ul>');
});

app.get('/uids', function(req, res) {
  db.open(function(err, db) {
    db.collection('uids', function(err, collection) {
      collection.find( function(err, cursor) {
        var result = "";
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            result += "\n" + item.uid + ":" + item.access_token;
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            res.setHeader('Content-Type', 'text/plain');
            res.send(result);
          }
        });
      });          
    });
  });
});


app.get('/try_check_in/:uid', function(req, res) {
  var uid = req.params.uid;
  db.open(function(err, db) {
    db.collection('uids', function(err, collection) {
      collection.find({'uid':uid}, function(err, cursor) {
        var alreadyStored = false;
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            alreadyStored = true;
            makeOpenGraphPost(item.access_token)
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            res.statusCode = alreadyStored? 200 : 205;
            res.send();
          }
        });
      });          
    });
  });
});

console.log("starting server");
app.listen(3727);

// call this to set a pairing in the database between the fob :uid
// and the facebook req.session.access_token
app.get('/newuid/:uid', function(req, res) {
  console.log("Hey someone tagged!");
  if (!req.session || !req.session.access_token) {
    console.log("NO ACCESS TOKEN FOR new uid.")
    res.redirect('/'); // Start the auth flow
    return;
  }
  
  var uid = req.params.uid;
  var access_token = req.session.access_token;

  // Save the uid with the access token
  console.log(uid);
  console.log(access_token);
  
  db.open(function(err, db) {
    db.collection('uids', function(err, collection) {
      collection.find({'uid':uid}, function(err, cursor) {
        var alreadyStored = false;
        cursor.each(function(err, item) {
          if(item != null) {
            console.log("Found this UID in the DB: " + item.uid);
            alreadyStored = true;
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
          }
          // Null signifies end of iterator
          if(item == null) {
            
            if (!alreadyStored) {
              console.log("storing this into DB:" + uid +"\t " + req.session.user.name);
              collection.insert({'uid':uid, 'access_token':access_token});
            }
            db.close();
          }
        });
      });
    });
  });

  res.redirect('/');
  // Create a timeline post

  // Serve a new page

  // var post_data = querystring.stringify({
  //   room: "http://thepaulbooth.com:3727/room/" + room_name + '?room_image='+room_image,
  //   access_token: access_token
  // });

  // var action_type = (entering_room == 'false') ? 'leave' : 'enter';
  // var options = {
  //   host: 'graph.facebook.com',
  //   headers: {
  //     'Content-Length': post_data.length,
  //     'Content-Type': 'application/x-www-form-urlencoded'
  //   },
  //   method: 'POST',
  //   path: '/me/doortracker:' + action_type + '?access_token=' + access_token
  // };

  // var request = https.request(options, function (response) {
  //   var str = '';
  //   response.on('data', function (chunk) {
  //     str += chunk;
  //   });

  //   response.on('end', function () {
  //     console.log(str);
  //     res.send(str);
  //   });
  // });
  // request.write(post_data);
  // request.end();  
  

});
console.log("that was cool");
