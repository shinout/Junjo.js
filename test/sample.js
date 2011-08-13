var node = (typeof exports == 'object' && exports === this);

// test start
function junjo_test() {
  const J = (node) ? require('../Junjo') : Junjo;
 
  var _ = new J({
    defaultCatcher: function(e) {
      console.log(e.stack);
      console.log("うおおおおおえらーーーーだーーーーーーーー");
      console.log("でも処理を続けるのさ _.terminate() してないからね。");
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
      cb(null, result);
    }, n);
  }

  _.run([
    _(function() {
      // throw "unko";
      asyncMethod("僕が最初に実行されます!", 30, this.callback); 
    }).label('start'),

    _(function() {
      asyncMethod("最初の奴が終わってから実行:shinです", 20, this.callback); 
      return "結果です。";
    }).label("shin").after("start"),

    _(function() {
      asyncMethod("依存関係の順序が逆。登録は早いけどsync2の後に実行されるのさ", 30, this.callback);
    }).after('sync2'),

    _(function() {
      asyncMethod("勝手に始めちゃうよ", 10, this.callback); 
    }),

    _(function() {
      asyncMethod("200msecもかかる処理です", 200, this.callback); 
    }).label('long'),

    _(function() {
      console.log("おおおおおおおおお");
      // throw new Error("えらー");
    }).label('えらら').catchAt('キャッチャー'),

    _(function(e) {
      consolelog(e.message);
      consolelog("this function is called only when an error is occurred");
      // _.terminate(); // これで次以降の処理はとまる
    }).label('キャッチャー').isCatcher(),

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
    }).catchAt('しんのすけ'),

    _(function() {
      consolelog("同期関数その2. 200msec処理後に走ります :start");
      consolelog("同期関数その2. 200msecのやつの結果.", _.results('long'));
      consolelog("同期関数その2. 200msec処理後に走ります :end");
      return "同期関数の場合戻り値がresultsに格納されます";
    }).after('long').label('sync2'),

    _(function() {
      consolelog("shinの結果です。", _.results('shin'));
    }).after("shin"),

    _(function() {
      consolelog("同期関数その2の結果です。", _.results('sync2'));
    }).after('sync2')
  ]);
}

if (node) { junjo_test();}
