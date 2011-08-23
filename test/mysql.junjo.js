if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  if (!node) return;

  var mysql  = require('mysql');
  var data   = require('./data');
  var client = mysql.createClient({
    user     : data.user,
    password : data.password,
  });

  var DB_NAME     = data.dbname;
  var TBL_NAME    = data.tblname;
  var COL_NAME    = data.colname;
  var DEFAULT_STR = data.default_str || 'MDS';

  var $j = new Junjo({ nodeCallback: true });

  function $query() {
    var sql  = Array.prototype.shift.call(arguments);
    var args = arguments;
    return $j(function() {
      // Junjo.args(args).forEach(function(v) { sql = sql.replace('%s', v) }); // future API
      console.log(sql);
      client.query(sql, this.callback);
    });
  }
  function $result(fn) { return $j(fn).after() }


  $query('use ' + DB_NAME);

  $j(function() {
    var num = Number(process.argv[2]);
    if (isNaN(num)) {
      // $j.skip('select'); // future API
      // $j.skip('word', process.argv[2] || DEFAULT_STR); // future API
      num = 1999;
    }
    this.shared.num = num;
  });

  // $query('select * from ' + TBL_NAME + ' limit %s,1', $j.shared('num')).label('select');// future API

  $j('select', function() {
    client.query('select * from ' + TBL_NAME + ' limit '+ this.shared.num +',1', this.callback);
  });

  $result(function(err, records, fields) {
    if (!records[0]) throw new Error();
    return records[0][COL_NAME];
  }).label('word');

  $j.catches(function() { return DEFAULT_STR });

  $result(function(word) {
    var word = word.split(/[をがのはやで、。]/)[0];
    console.log("searching " + word);
    client.query('select * from ' + TBL_NAME + ' where ' + COL_NAME + ' like "%'+ word +'%" limit 5', this.callback);
  });

  $result(function(e, records, f) {
    console.log(records);
  });

  // catcher
  $j.catchesAbove(function(e, jfn) {
    console.log(e.stack);
    console.log("from : " + jfn.label());
    $j.terminate();
  });


  $j.on('end', function() {
    console.log("end");
    client.end();
  });

  $j.run();
}
