const WorkFlow = require('../WorkFlow');
const mysql = require('mysql');
const DB_NAME = 'test_workflow';

/* db mock */
const db = {
  createDB : function(dbname, fn) {
    console.log('creating database : ' + dbname);
    setTimeout(fn(null, true), 30);
  },

  createSchema : function(name, data, fn) {
    console.log('creating schema : ' + name);
    console.log(data);
    db._s[name] = data;
    db._d[name] = []; //initialize
    setTimeout(fn(null, true), 50);
  },

  useDB : function(dbname, fn) {
    console.log('database changed : ' + dbname);
    setTimeout(fn(null, true), 10);
  },

  insert: function(name, data, fn) {
    console.log('insert data into ' + name);
    console.log(data);
    if (!db._d[name]) throw "no such table";
    db._d[name].push(data);
    setTimeout(fn(null, true), 20);
  },

  find: function(name, cond, fn) {
    if (!db._d[name]) throw "no such table";
    setTimeout(fn(null, db._d[name].filter(function(v) { return true; })), 40);
  },

  getById: function(name, id, fn) {
    if (!db._d[name]) throw "no such table";
    var result;
    db._d[name].some(function(data) {
      if (data.id && data.id == id) {
        result = data;
        return true;
      }
      return false;
    });
    setTimeout(fn(null, result), 8);
    return result;
  },

  getByColumn: function(name, k, v, fn) {
    if (!db._d[name]) throw "no such table";
    var results = [];
    db._d[name].forEach(function(data) {
      if (data.id && data[k] == v) {
        results.push(data);
      }
    });
    setTimeout(fn(null, results), 30);
  },

  // data
  _d : {},
  // schema
  _s : {}
};

const TABLE1  = 'user';
const TABLE2  = 'notebook';
const TABLE1_DATA = {
  id: {pk: true, autoIncrement: true},
  name : {required: true, _default: ""},
  birthday : {datatype: "datetime", required: false}
};

const TABLE2_DATA = {
  id: {pk: true, autoIncrement: true},
  name : {required: true, _default: "NONAME"},
  content : {datatype: 'text', required: true},
  user_id : {datatype: 'int'}
};

// test start
tx = new WorkFlow();
tx.run({
  CD : [db.createDB, DB_NAME],
  UD : [db.useDB, DB_NAME],
  CS1: [db.createSchema, TABLE1, TABLE1_DATA],
  CS2: [db.createSchema, TABLE2, TABLE2_DATA],

  N : [db.insert, TABLE1, {id: 1, name: 'nishiko'}],
  N1: [db.insert, TABLE2, {id: 1, name: 'マインディア', content: "みんなの百科事典", user_id: 1}],
  N2: [db.insert, TABLE2, {id: 2, name: 'パンデイロ', content: "打楽器。", user_id: 1}],

  T : [db.insert, TABLE1, {id: 2, name: 'tnantoka'}],
  T1: [db.insert, TABLE2, {id: 3, name: 'loose leaf', content: "blog engine.", user_id: 2}],
  T2: [db.insert, TABLE2, {id: 4, name: 'jsany', content: "js in iPhone", user_id: 2}],

  S : [db.insert, TABLE1, {id: 3, name: 'shinout'}],
  S1: [db.insert, TABLE2, {id: 5, name: 'umecob.js', content: "template engine.", user_id: 3}],
  S2: [db.insert, TABLE2, {id: 6, name: 'WorkFlow', content: "つくってますよ", user_id: 3}],

  Q1: [db.getByColumn, TABLE1, 'name', 'nishiko'],
  Q2: ['Q1', db.getByColumn, TABLE2, 'user_id', tx("Q1", 1, 0, "id")],
  RS: ['S1', 'Q2', function() {console.log("results", tx.Q2)}]
});

