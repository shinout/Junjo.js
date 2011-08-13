var node = (typeof exports == 'object' && exports === this);

// test start
function junjo_test() {
  const J = (node) ? require('../Junjo') : Junjo;

  var _ = new J({
    defaultCatcher: function(e) {
      console.log("うおおおおおえらーーーーだーーーーーーーー");
      console.log("でも処理を続けるのさ _.setError() してないからね。");
    },

    onEnd: function() {
      console.log("終了しました");
    },

    onSuccessEnd : function() {
      console.log("無事終了しました。");
    },

    onErrorEnd: function() {
      console.log("エラー終了しました。");
    }
  });

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
      // throw "unko";
      asyncMethod("僕が最初に実行されます!", 30, callback); 
    }).label('start'),

    _(function(callback) {
      asyncMethod("最初の奴が終わってから実行:shinです", 20, callback); 
      return "結果です。";
    }).label("shin").after("start"),

    _(function(callback) {
      asyncMethod("依存関係の順序が逆。登録は早いけどsync2の後に実行されるのさ", 30, callback);
    }).after('sync2'),

    _(function(callback) {
      asyncMethod("勝手に始めちゃうよ", 10, callback); 
    }),

    _(function(callback) {
      asyncMethod("200msecもかかる処理です", 200, callback); 
    }).label('long'),

    _(function(callback) {
      console.log("おおおおおおおおお");
      // throw new Error("えらー");
    }).sync().label('えらら').catchAt('catcher'),

    _(function(e) {
      consolelog(e.message);
      consolelog("this function is called only when an error is occurred");
      // _.setError(); // これで次以降の処理はとまる
    }).label('catcher').isCatcher(),

    _(function(e) {
      consolelog(e.message);
      consolelog("しんのすけ。俺もキャッチャー.");
      consolelog("平時には実行されない。つまり、isCatcher()は必須ではない。catchAtで指定されたらそいつはキャッチャー");
    }).label('しんのすけ'),

    _(function(e) {
      consolelog(e.message);
      consolelog("誰からもthrowされないけど、キャッチャーだから実行されない");
    }).label('george').isCatcher(),

    _(function() {
      consolelog("同期関数です.マイペース。: start");
      consolelog("同期関数です.マイペース。: end");
      // throw new Error("あべ");
    }).sync().catchAt('しんのすけ'),

    _(function() {
      consolelog("同期関数その2. 200msec処理後に走ります :start");
      consolelog("同期関数その2. 200msecのやつの結果.", _.results.long);
      consolelog("同期関数その2. 200msec処理後に走ります :end");
      return "同期関数の場合戻り値がresultsに格納されます";
    }).after('long').label('sync2').sync(),

    _(function(callback) {
      consolelog("shinの結果です。", _.results.shin);
    }).after("shin").sync(),

    _(function(callback) {
      consolelog("同期関数その2の結果です。", _.results.sync2);
    }).sync().after('sync2')
  ]);
/*

  // 配列ではなく引数を列挙して実行

  var j = new J({
    defaultCatcher: function(e) {
      console.log("うおおおおおえらーーーーだーーーーーーーー");
      console.log("でも処理を続けるのさ j.setError() してないからね。");
    },
    after : _
  });

  j.run(
    j(function(callback) {
      throw "unko";
      asyncMethod("僕が最初に実行されます!", 30, callback); 
    }).label('start'),

    j(function(callback) {
      asyncMethod("最初の奴が終わってから実行:shinです", 20, callback); 
      return "結果です。";
    }).label("shin").after("start"),

    j(function(callback) {
      asyncMethod("依存関係の順序が逆。登録は早いけどsync2の後に実行されるのさ", 30, callback);
    }).after('sync2'),

    j(function(callback) {
      asyncMethod("勝手に始めちゃうよ", 10, callback); 
    }),

    j(function(callback) {
      asyncMethod("200msecもかかる処理です", 200, callback); 
    }).label('long'),

    j(function(callback) {
      throw new Error("えらー");
    }).label('えらら').catchAt('catcher'),

    j(function(e) {
      consolelog(e.message);
      consolelog("this function is called only when an error is occurred");
      // j.setError(); // これで次以降の処理はとまる
    }).label('catcher').isCatcher(),

    j(function(e) {
      consolelog(e.message);
      consolelog("しんのすけ。俺もキャッチャー.");
      consolelog("平時には実行されない。つまり、isCatcher()は必須ではない。catchAtで指定されたらそいつはキャッチャー");
    }).label('しんのすけ'),

    j(function(e) {
      consolelog(e.message);
      consolelog("誰からもthrowされないけど、キャッチャーだから実行されない");
    }).label('george').isCatcher(),

    j(function() {
      consolelog("同期関数です.マイペース。: start");
      consolelog("同期関数です.マイペース。: end");
      throw new Error("あべ");
    }).sync().catchAt('しんのすけ'),

    j(function() {
      consolelog("同期関数その2. 200msec処理後に走ります :start");
      consolelog("同期関数その2. 200msecのやつの結果.", j.results.long);
      consolelog("同期関数その2. 200msec処理後に走ります :end");
      return "同期関数の場合戻り値がresultsに格納されます";
    }).after('long').label('sync2').sync(),

    j(function(callback) {
      consolelog("shinの結果です。", j.results.shin);
    }).after("shin"),

    j(function(callback) {
      consolelog("同期関数その2の結果です。", j.results.sync2);
    }).sync().after('sync2')
  );
*/

}

if (node) { junjo_test();}
