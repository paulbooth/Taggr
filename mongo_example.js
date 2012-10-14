var mongo = require('mongodb'),
  Server = mongo.Server,
  Db = mongo.Db;

var client = new Db('test', new Server("127.0.0.1", 27017, {}), {safe:true}),
        test = function (err, collection) {
          collection.insert({a:3}, function(err, docs) {

            collection.count(function(err, count) {
              test.assertEquals(1, count);
            });

            // Locate all the entries using find
            collection.find().toArray(function(err, results) {
              // test.assertEquals(1, results.length);
              // test.assertTrue(results[0].a === 2);
              console.log(results);
              // Let's close the db
              client.close();
            });
          });
        };

    client.open(function(err, p_client) {
      client.collection('test_insert', test);
    });