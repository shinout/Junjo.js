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
  onEnd: function() {
    console.log("end");
    client.end();
  },
  nodeCallback: true
});

jj.run(
  //jj(client.query).scope(client).params('use ' + DB_NAME, jj.callback),
  jj(client.query).bind(client, 'use ' + DB_NAME, jj.callback),

  jj(client.query).bind(client, 'select * from ' + TBL_NAME, jj.callback)
  .label('select'),

  jj(console.log).params(jj.results('select', 1, 3, 'name')).afterAbove(),

  jj(function(err, records, fields) {
    console.log('field', fields);
    return "NEXT VALUE";
  }).after("select"),

  jj(console.log).params(jj.args(0), jj.callback).after().timeout(1),
  //jj(console.log).params(jj.args(0), jj.callback).after().timeout(0.1),

  // catcher
  jj(function(e, jfn) {
    console.log(e.message);
    jj.terminate();
  }).catchesAbove()
);
