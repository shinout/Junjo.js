const WorkFlow = require('../WorkFlow');

// test start
_ = new WorkFlow();

function asyncMethod(name, n, cb) {
  console.log(name + ' : start');
  var result = "表示ログ = [" + name + "]";
  setTimeout(function() {
    console.log(name + ' : end');
    cb(null, result);
  }, n);
}

_.run([
  _(function(callback) {
    asyncMethod("僕が最初に実行されます!", 30, callback); 

  }).label('start'),

  _(function(callback) {
    asyncMethod("最初の奴が終わってから実行:shinです", 20, callback); 
    return "結果です。";
  }).label("shin").after("start"),

  _(function(callback) {
    asyncMethod("勝手に始めちゃうよ", 10, callback); 
  }),

  _(function(callback) {
    asyncMethod("200msecもかかる処理です", 200, callback); 
  }).label('long'),

  _(function() {
    console.log("同期関数です.マイペース。: start");
    console.log("同期関数です.マイペース。: end");
  }).sync(),

  _(function() {
    console.log("同期関数その2. 200msec処理後に走ります :start");
    console.log("同期関数その2. 200msecのやつの結果.", _.results.long);
    console.log("同期関数その2. 200msec処理後に走ります :end");
    return "同期関数の場合戻り値がresultsに格納されます";
  }).after('long').label('sync2').sync(),

  _(function(callback) {
    console.log("shinの結果です。", _.results.shin);
  }).after("shin"),

  _(function(callback) {
    console.log("同期関数その2の結果です。", _.results.sync2);
  }).sync().after('sync2')
]);
