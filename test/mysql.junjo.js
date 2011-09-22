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

  var $j = new Junjo({ firstError: true });

  function $query() {
    var label = Array.prototype.shift.call(arguments);
    var sql  = Array.prototype.shift.call(arguments);
    var args = arguments;
    return $j(label, function() {
      Array.prototype.forEach.call(args, function(v) { sql = sql.replace('%s', Junjo.present(v)) });
      console.log(sql);
      client.query(sql, this.callback);
    });
  }
  function $result(label, fn) { return $j(label, fn).after() }


  $query('use', 'use ' + DB_NAME);

  $j(function() {
    var num = Number(process.argv[2]);
    if (isNaN(num)) {
      this.skip('select');
      this.skip('word', process.argv[2] || DEFAULT_STR);
      num = 1999;
    }
    this.shared.num = num;
  });

  $query('select', 'select * from ' + TBL_NAME + ' limit %s,1', $j.future.shared('num'));

  $result('word', function(err, records, fields) {
    if (!records[0]) throw new Error();
    return records[0][COL_NAME];
  });

  $j.catches(function() { return DEFAULT_STR });

  $result('get', function(word) {
    var word = word.split(/[をがのはやで、。]/)[0];
    console.log("searching " + word);
    client.query('select * from ' + TBL_NAME + ' where ' + COL_NAME + ' like "%'+ word +'%" limit 5', this.callback);
  });

  $result('log', function(e, records, f) {
    console.log(records);
  });

  // catcher
  $j.catchesAbove(function(e, args) {
    console.log(e.stack);
    console.log("from : " + this.label);
    this.terminate();
  });


  $j.on('end', function() {
    console.log("end");
    client.end();
  });

  $j.run();
}
