/** //
* en : When running in browsers, comment out this line.
* ja : ブラウザで実行する場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');
var $j = new Junjo({
  catcher : function(e, args) { // (6)
    console.log(this.label + ' threw an error with a message : "' + e.message + '". I\'m a new default catcher.');
  }
});

$j('Pitcher01', function() {
  throw new Error('no way!');
});

$j.catches(function(e, args) { // (1)
  console.log(this.label + ' threw an error with a message : "' + e.message + '". I caught it.');
});

$j('Pitcher02', function() {
  throw new Error('no way!');
});

$j('Pitcher03', function() {
  throw new Error('no way!');
});

$j.catches('Pitcher02', function(e, args) { // (2)
  console.log(this.label + ' threw an error with a message : "' + e.message 
                          + '". I catch an error thrown by Pitcher02.');
});

$j('Pitcher04', function() {
  throw new Error('no way!');
});

$j.catchesAbove(function(e, args) { // (3)
  console.log(this.label + ' threw an error with a message : "' + e.message 
                          + '". I caught all the errors occurred above.');
});

$j('Pitcher05', function() {
  throw new Error('no way!');
})
.fail(function(e, args) { // (4)
  console.log(this.label + ' threw an error with a message : "' + e.message 
                          + '". This is the similar way as JSDeferred.');
});

$j('Pitcher06', function() {
  throw new Error('no way!');
})
.catches(function(e, args) { // (5)
  console.log(this.label + ' threw an error with a message : "' + e.message 
                          + '". This is the same as fail().');
});

$j('Pitcher07', function() {
  throw new Error('no way!');
});

$j.run();

/** title
* en : catching errors 1 : register catcher functions
* ja : エラーを処理する 1: catcher関数の登録
**/

/** output

Pitcher01 threw an error with a message : "no way!". I caught it.
Pitcher02 threw an error with a message : "no way!". I catch an error thrown by Pitcher02.
Pitcher03 threw an error with a message : "no way!". I caught all the errors occurred above.
Pitcher04 threw an error with a message : "no way!". I caught all the errors occurred above.
Pitcher05 threw an error with a message : "no way!". This is the similar way as JSDeferred.
Pitcher06 threw an error with a message : "no way!". This is the same as fail().
Pitcher07 threw an error with a message : "no way!". I'm a new default catcher.

**/


/** description(en)
When an exception is thrown in a function, a "catcher function" of the function is called.
If no catcher function is registered, $j.defaultCatcher() is called.
This function execute console.error(error.stack) and stop all the succeeding processes registered in $j.
Catcher functions are passed two arguments:
  1: error object
  2: list of arguments passed to original function which occurred an error
The "this" variable in catcher functions is the same as th function which occurred an error.

A returned value of catcher functions affects the succeeding processes.
We will explain the detail in the next section.

1. $j.catches(fn) : register a catcher function fn to the previously registered function.

2. $j.catches(label, fn) : register a catcher function fn to the function labeled "label".

3. $j.catchesAbove(fn) : register a catcher function fn to all the registered function above
except those already have their own catcher function.

4. $(fn1).fail(fn2) : register a catcher function fn2 to fn1.

5. $(fn).catches(fn2) : the same as fail()
as fn is at first parsed as a normal function (not a catcher), then converted.

6. new Junjo({ catcher: fn }) : set fn as a default catcher function.

**/

/** description(ja)

関数内で例外がスローされると、その関数のcatcher関数が呼び出されます。
特にcatcher関数が指定されていない時は $j.defaultCatcher() という関数が実行されます。
この関数はe.stack をconsole.error したのち、$jに登録されたすべての後続の処理を中止するというものです。
catcher関数には2つの引数が渡されます。
第1引数はエラーオブジェクト、
第2引数にはエラーを起こした関数の引数を含んだ配列が渡されます。
戻り値は、その後の実行に影響がありますが、それは次のセクションで説明します。
catcher関数におけるthisは、エラーを起こした関数のthisと同一です。

1. $j.catches(fn) で 直前に登録された関数のcatcher関数がfn となります。

2. $j.catches(label, fn) で labelをラベルに持つ関数のcatcher関数がfn となります。

3. $j.catchesAbove(fn) で そのタイミングで登録されているすべての関数のcatcher関数がfn となります。
なお、すでにcatcher関数が登録されている場合には適用されません。

4. $(fn1).fail(fn2) で fn1のcatcher関数をfn2にします。

5. $(fn).catches(fn2) はfail()と同様です。
一度catcherでない普通の関数として登録される処理を挟んでしまうため他の方法に比べ処理が遅いからです。

6. new Junjo({ catcher: fn }) で fn が、デフォルトのcatcherに指定されます。

**/
