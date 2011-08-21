var mongo      = require('mongodb'),
    DB         = mongo.Db,
    Connection = mongo.Connection,
    Server     = mongo.Server;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;
var client = new DB('node-mongo-examples', new Server(host, port, {}), {});
console.log("connecting to " + host);

var Junjo = require('../Junjo');

var and = new Junjo({ 
  nodeCallback : true,
  timeout      : 3,
  catcher      : function(e, jfn) {
    console.error(jfn.label());
    return and.defaultCatcher(e, jfn);
  }
});

and(function() { client.open(this.callback) })

and(function(err, conn) {
  this.shared.conn = conn;
  conn.dropDatabase(this.callback);
}).after()

and(function(err, result) {
  var self = this;
  this.shared.conn.collection('test', this.callback);
}).after()

and(function(err, collection) {
  this.shared.coll = collection;
  collection.remove({}, this.callback);
}).after()

and(function(err, result) {
  var coll = this.shared.coll;
  for (var i = 0; i < 3; i++) {
    console.log("inserting " + i);
    coll.insert({a : i});
  }
  coll.count(this.callback);
}).after()

and(function(err, count) {
  console.log('There are ' + count + ' records in the test collection. Here they are:');
  this.shared.coll.find(this.callback);
}).after()

and(function(err, cursor) {
  var self = this;
  cursor.each(function(err, item) {
    if (item != null) {
      console.log(item);
      console.log("create at " + new Date(item._id.generationTime));
    }
    else {
      self.shared.coll.drop(self.callback);
    }
  });
}).after().async();

and.on('end', function() {
  client.close();
});


and.run();
