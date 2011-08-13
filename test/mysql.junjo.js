const mysql  = require('mysql');
const data   = require('./data');
const client = mysql.createClient({
  user     : data.user,
  password : data.password,
});

const Junjo = require('../Junjo');

const DB_NAME  = data.dbname;
const TBL_NAME = data.tblname;

const jj = new Junjo({
  onEnd: function() {
    console.log("end");
    client.end();
  }
});

jj.run(
  //jj(client.query).scope(client).params('use ' + DB_NAME, jj.callback).catchAt('mysqlError'),
  jj(client.query).bind(client, 'use ' + DB_NAME, Junjo.callback).catchAt('mysqlError'),

  jj(client.query).bind(client, 'select * from ' + TBL_NAME, Junjo.callback)
  .catchAt('mysqlError'),

  jj(function(err, result) {
    console.log(result);
  }).after(),

  jj('mysqlError', function(e, jfn) {
    console.log("from label " + jfn.label());
    console.log(e.stack);
    jj.terminate();
  })
);
