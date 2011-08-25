/** //
* en : When running in browsers, comment out this line.
* ja : ブラウザで実行する場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');

/** ** 
* en : (an asynchronous function which execute a callback function after the whole process.
* ja : 処理完了後にcallbackを実行する非同期な関数 
**/
function asyncFunc(v1, v2, v3, v4, callback) {
  console.log(v1, v2, v3, v4);
  setTimeout(function() { callback(v1 + '(async)', 'arg2') }, 10);
}

var $j = new Junjo();

$j('A', function(abc, aiu) { // (1)
  console.log(abc, aiu); // ABC, AIU
  this.shared.fuga = abc;
  return aiu;
});

$j('B', function(abc, aiu) {
  console.log(abc, aiu);  // ABCDE, AIUEO
  asyncFunc(
    this.label(),
    $j.results('A'),
    aiu,
    this.shared.fuga,
    this.callback
  );
}).params('ABCDE', 'AIUEO'); // (2)

$j('C', asyncFunc).after()
.params(
  $j.label,           // (3-1)
  $j.results('B', 0), // (3-2)
  $j.args(1),         // (3-3)
  $j.shared('fuga'),  // (3-4)
  $j.callback         // (3-5)
);

$j.run('ABC', 'AIU'); // (1)


/** title
* en : pass arguments explicitly
* ja : 引数を明示的に渡す
**/

/** output

ABC AIU
ABCDE AIUEO
B AIU AIUEO ABC
C B(async) arg2 ABC

**/


/** description(en)

1. The default arguments passed to functions without after() are the same as those passed to $j.run() .
The default arguments passed to functions with after() are, explained in "after" section.

2. Arguments passed to function fn is the arguments passed to $j(fn).params() .
The default arguments are not used.

3. We can pass special arguments to $j(fn).params().

3-1. $j.label : the label of function fn.

3-2. $j.results(label, key1, key2, ...) : the result of the labeled function.
Let results object as obj, then this means obj[key1][key2][...] .

3-3. $j.args(N) : the Nth default argument of function fn.

3-4. $j.shared(key1, key2, ...) : let a shared object(explains in a later section) as obj,
then this means obj[key1][key2][...] .

3-5. $j.callback : the same as "this.callback" in function fn.

**/

/** description(ja)

1. after()のない関数へのデフォルトの引数は, $j.run()への引数です。
after()のある関数へのデフォルトの引数は、after() の項に詳しく解説しています。

2. $j(fn).params() への引数が、関数fnへの引数です。デフォルトの引数は上書きされます(使われません).

3. paramsへの引数には、特殊な値を用いることができます。

3-1. $j.label : その関数のラベル。

3-2. $j.results(label, key1, key2, ...) : 指定されたラベルを持つ関数の結果。
結果オブジェクトobj に対し obj[key1][key2][...] を返します。

3-3. $j.args(N) : その関数へのデフォルトの第N引数。

3-4. $j.shared(key1, key2, ...) : sharedオブジェクト(あとで解説)がobjである場合、
obj[key1][key2][...] の値。

3-5. $j.callback : その関数のthis.callback の値。

**/
