var node = (typeof exports == 'object' && exports === this);

// test start
function junjo_test() {
  const J = (node) ? require('../Junjo') : Junjo;

  var _ = new J();

  function consolelog() {
    if (node) {
      console.log.apply(this, arguments);
    }
    else {
      Array.prototype.forEach.call(arguments, function(v) {
        console.log(v);
        var el = document.createElement('li');
        el.innerHTML = v.toString();
        document.getElementById('test').appendChild(el);
      });
    }
  }

  function asyncMethod(name, n, cb) {
    consolelog(name + ' : start');
    var result = "表示ログ = [" + name + "]";
    setTimeout(function() {
      consolelog(name + ' : end');
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
      consolelog("同期関数です.マイペース。: start");
      consolelog("同期関数です.マイペース。: end");
    }).sync(),

    _(function() {
      consolelog("同期関数その2. 200msec処理後に走ります :start");
      consolelog("同期関数その2. 200msecのやつの結果.", _.results.long);
      consolelog("同期関数その2. 200msec処理後に走ります :end");
      return "同期関数の場合戻り値がresultsに格納されます";
    }).after('long').label('sync2').sync(),

    _(function(callback) {
      consolelog("shinの結果です。", _.results.shin);
    }).after("shin"),

    _(function(callback) {
      consolelog("同期関数その2の結果です。", _.results.sync2);
    }).sync().after('sync2')
  ]);
}

if (node) { junjo_test();}
