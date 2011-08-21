var mysql  = require('mysql');
var data   = require('./data');
var client = mysql.createClient({
  user     : data.user,
  password : data.password,
});

var Junjo = require('../Junjo');

var DB_NAME  = data.dbname;
var TBL_NAME = data.tblname;

var jj = new Junjo({
  nodeCallback: true
});

jj(client.query).bind(client, 'use ' + DB_NAME, jj.callback);

jj(client.query).bind(client, 'select * from ' + TBL_NAME + ' limit 10', jj.callback)
.label('select');

jj(function() {
  console.log(arguments);
}).afterAbove();

// catcher
jj.catchesAbove(function(e, jfn) {
  console.log("err" + e.message);
  jj.terminate();
});


jj.on('end', function() {
  console.log("end");
  client.end();
});

jj.run();
