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
  //jj(client.query).scope(client).params('use ' + DB_NAME, Junjo.callback).catchAt('mysqlError'),
  jj(client.query).bind(client, 'use ' + DB_NAME, Junjo.callback).catchAt('mysqlError'),

  jj(client.query).bind(client, 'select * from ' + TBL_NAME, Junjo.callback)
  .catchAt('mysqlError').label('select'),


  jj(console.log).params(Junjo.results('select', 1, 3, 'name')).after('select'),

  jj(function() {
    console.log('field', this.args(2).id);
    return "NEXT VALUE";
  }).after("select"),

  jj(console.log).params(Junjo.args(0), Junjo.callback).after().timeout(1),
  //jj(console.log).params(Junjo.args(0), Junjo.callback).after().timeout(0.1).catchAt('mysqlError'),

  jj('mysqlError', function(e, jfn) {
    jj.terminate();
  })
);
