if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  if (!node) return;
  var mongo      = require('mongodb'),
      DB         = mongo.Db,
      Connection = mongo.Connection,
      Server     = mongo.Server;

  var N = 0; console.time(N);
  function showTime() { console.timeEnd(N); console.time(++N); }

  var host = 'localhost';
  var port = Connection.DEFAULT_PORT;
  var client = new DB('node-mongo-examples', new Server(host, port, {}), {});
  console.log("connecting to " + host);

  var $j = new Junjo({
    firstError   : true,
    timeout      : 3,
    catcher      : function(e, jfn) {
      console.error(jfn.label());
      return j.defaultCatcher(e, jfn);
    }
  });

  $j.getResult = function(jfn) {
    var result = $j.results(jfn.label(), 1);
    var ret = function() {
      var args = arguments;
      var next_jfn = $j(function() {
        showTime();
        var obj   = result.get();
        var fname = Array.prototype.shift.call(args);
        Array.prototype.push.call(args, this.callback);
        obj[fname].apply(obj, args);
      }).after(jfn.label());
      return $j.getResult(next_jfn);
    };
    ret.next = function() { jfn.next.apply(jfn, arguments) };
    return ret;
  };

  var $open = function() { return $j.getResult($j(client.open).bind(client, $j.callback)) };

  /****** START *********/
  var $conn = $open();
  $conn('dropDatabase');

  var $coll = $conn('collection', 'test');
  $coll('remove', {});

  for (var i=0; i<3; i++) $coll('insert', {a : i});

  $coll('count')
  .next(function(err, count) {
    showTime();
    console.log("There are " + count + " records in the test collection. Here they are:");
  });

  $coll('find')
  .next(function(err, cursor) {
    showTime();
    cursor.each(function(err, item) {
      if(item != null) {
        showTime();
        console.log(item);
        console.log("created at " + new Date(item._id.generationTime) + "\n")
      }
    });
  });

  $j.on('end', function() {
    client.close();
  });

  $j.run();
}
