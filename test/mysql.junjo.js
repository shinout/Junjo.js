var mysql  = require('mysql');
var data   = require('./data');
var client = mysql.createClient({
  user     : data.user,
  password : data.password,
});

var Junjo = require('../Junjo');

var DB_NAME  = data.dbname;
var TBL_NAME = data.tblname;

var jj = new Junjo({ nodeCallback: true });

jj(function() {
  var num = Number(process.argv[2]);
  if (isNaN(num)) num = 400;
  this.shared.num = num;
});

jj(client.query).bind(client, 'use ' + DB_NAME, jj.callback);

jj(function() {
  client.query('select * from ' + TBL_NAME + ' limit '+ this.shared.num + ',1', jj.callback)
}).label('select');

jj(function(err, records, f) {
  var col = Object.keys(records[0])[1];
  return [col, records[0][col]];
}).after();

jj(function(arr) {
  var col = arr[0], val = arr[1];

  var word = val.split(/[をがのはやで、。]/)[0];
  console.log("searching " + word);
  client.query('select * from ' + TBL_NAME + ' where ' + col + ' like "%'+ word +'%" limit 5', this.callback);
}).after();


jj(function(e, records, f) {
  console.log(records);
}).after();


// catcher
jj.catchesAbove(function(e, jfn) {
  console.log("err: " + e.message);
  console.log("from : " + jfn.label());
  jj.terminate();
});


jj.on('end', function() {
  console.log("end");
  client.end();
});

jj.run();
