// door tracker
// var apiKey = '423298101062880';
// var secretKey = '3ea916ceaa6675538845a6ad37268692';

//taggr
var apiKey = '162309810576217';
var secretKey = 'cfcce3d3e6a2cec6bae74c90b9ca3387';

var argv = process.argv;
var https = require('https'), http = require('http');
var querystring = require('querystring');

var hostUrl = 'http://thepaulbooth.com:3727';

var express = require('express'),
    app = express();

// Well, this thing works really well, so...
var OpenGraph = require('facebook-open-graph'),
    openGraph = new OpenGraph('fbtaggr');

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

app.get('/', function(req, res) {
  res.render('index.jade');
})

// First part of Facebook auth dance
app.get('/login', function(req, res){
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

  var locals = {name: req.session.user.name};
  getUidsForAccessToken(req.session.access_token, function(uids) {
    locals.uids = JSON.parse(uids);
    console.log("LOCALS HERE:");
    console.log(locals);
    res.render('taggr.jade', locals);
  })
  
  // console.log("user:")
  // console.log(JSON.stringify(req.session.user, undefined, 2));
  // console.log(req.session.access_token);
  //res.render('taggr.jade', locals);
  //res.send("CHATTING IT UP, " + my_user.name + ", with: <ul><li>" + ONLINE.join('</li><li>') + '</li></ul>');
});

// helper endpoint for checking the DB
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

app.get('/logout', function(req, res) {
  if (!req.session.access_token) {
    res.redirect('/');
    return;
  }
  var fbLogoutUri = 'https://www.facebook.com/logout.php?next=' + hostUrl + '/&access_token=' + req.session.access_token
  req.session.user = null;
  req.session.access_token = null;
  res.redirect(fbLogoutUri);
});

app.get('/clear_user', function(req, res) {
  if (!req.session.access_token) {
    res.redirect('/');
    return;
  }

  // Clear their access token from the db
  disassociateUserFromTaggr(req.session.access_token, function() {
    // Refresh the page
    res.redirect('/');
  });
});



// Will post to facebook if linked (return 200). Otherwise, returns a 205.
app.get('/try_check_in/:uid/:spot_name', function(req, res) {
  var uid = decodeURIComponent(req.params.uid);
  var spot_name = decodeURIComponent(req.params.spot_name);
  var spot_image = decodeURIComponent(req.query['spot_image']);
  // console.log("before");
  // console.log("THE UID WE ARE TYING TO FIND IS:" + uid + ":" + uid.length);
  // console.log("after");
  db.open(function(err, db) {
    db.collection('uids', function(err, collection) {
      // console.log("going to try to find it now");
      collection.find({ uid : uid }, function(err, cursor) {
        var alreadyStored = false;
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            alreadyStored = true;
            openGraphTagSpot(item.access_token, spot_name, spot_image)
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            res.statusCode = alreadyStored? 200 : 205;
            res.end();
          }
        });
      });          
    });
  });
});

// returns array of ids hooked up to your access token
// should only ever have one...
app.get('/get_ids/:access_token', function(req, res) {
  var access_token = decodeURIComponent(req.params.access_token);
  getUidsForAccessToken(access_token, function(matched) { res.end(matched);})
});

function getUidsForAccessToken(access_token, callback) {
  db.open(function(err, db) {
    db.collection('uids', function(err, collection) {
      // console.log("going to try to find it now");
      collection.find({ access_token : access_token }, function(err, cursor) {
        var matched = []
        cursor.each(function(err, item) {
          if(item != null) {
            console.dir(item);
            //console.log("created at " + new Date(item._id.generationTime) + "\n")
            matched.push(item);
          }
          // Null signifies end of iterator
          if(item == null) {
            db.close();
            callback(JSON.stringify(matched));
          }
        });
      });          
    });
  });
}

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
  disassociateUserFromTaggr(access_token, function() {
    storeAccessTokenAndUid(access_token, uid, function() {});
  });

  res.redirect('/');

});

// url to get a specific spot
// each spot is an open graph object page
// usage:
// /spot/My Spot?spot_image=http://myspot.com/image.png
app.get('/spot/:spot_name', function(req, res) {
  var spot_name = req.params.spot_name;
  var spot_image = req.query["spot_image"] || 'http://sphotos-a.xx.fbcdn.net/hphotos-ash4/923_10151300013260676_847787992_n.jpg';
  console.log("RENDER with " + spot_image);
  res.render('spot.jade', {spot_name: spot_name, spot_image: spot_image});
});

function openGraphTagSpot(access_token, spot_name, spot_image) {
  console.log("Tagging user with access token " + access_token + " at location " + spot_name + " with image:" + spot_image);
  var spot_url = 'http://thepaulbooth.com:3727/spot/' + spot_name + (spot_image ? ("?spot_image=" + spot_image) : "")
  openGraph.publish('me',access_token,'tag', 'spot', spot_url, function(err,response){
    console.log(response);
  })
}

// Adds and links the access_token and the uid in the database
function storeAccessTokenAndUid(access_token, uid, callback) {
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
              console.log("storing this into DB:" + uid +"\t " + access_token);
              collection.insert({'uid':uid, 'access_token':access_token});
            }
            db.close();
            callback();
          }
        });
      });
    });
  });
}

function fetchUserFromDatabaseWithUID(uid, callback) {
  db.open(function(err, db) {
    db.collection('uids', function(err, collection) {
      collection.find({'uid':uid}, function(err, cursor) {
        cursor.each(function(err, item) {
          if(item != null) {
            console.log("Found this UID in the DB: " + item.uid);
            callback(item);
          }
          if (item == null) {
            db.close();
            callback(null);
          }
        });
      });
    });
  });
}

// Delete the database entry linking an access token with a uid
function disassociateUserFromTaggr(access_token, callback) {

// Open up the database
db.open(function(err, db) {
  // Grab the uid collection
    db.collection('uids', function(err, collection) {
      // Remove the entry with the access token provided
      collection.remove({'access_token':access_token}, function(err, cursor) {
        db.close();
        callback();
      });
    });
  });

}
console.log("starting server");
app.listen(3727);
console.log("that was cool");
