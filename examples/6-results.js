/** ** 
* en : (an asynchronous function which execute a callback function after the whole process.
* ja : 処理完了後にcallbackを実行する非同期な関数 
**/
function asyncFunc(v, callback) {
  setTimeout(function() { callback(v + '(async)', 'arg2') }, 10);
}

/** //
* en : if not running with Node.js, comment out this line.
* ja : Node.jsで実行しない場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');
var $j = new Junjo();


$j('hello', function() {
  return this.label() + ', world';
});

$j('hi', function() {
  asyncFunc(this.label(), this.callback);
});

$j(function(v1, v2, v3) {
  console.log($j.results('hello')); // (1)
  console.log($j.results('hi')); // (2)

  console.log(v1 === $j.results('hello'));

  console.log(v2 === $j.results('hi')[0]); // (2)

  console.log(v3 === $j.results('hi')[1]); // (2)
}).after('hello', 'hi');


$j(console.log).params($j.results('hello')) // (3)
.after();

$j(console.log).params($j.results('hi', 0)) // (4)
.after();


$j.run(); 


/** title
* en : get the results
* ja : 実行結果を取得する
**/


/** output

hello, world
{ '0': 'hi(async)' }
true
true
true
hello, world
hi(async)

**/


/** description(en)

1. We can get the results of the functions with label <label> by calling $j.results(<label>) .
If the function is synchronous, the returned value is obtained.

2.  If the function is asynchronous, the arguments object of the callback is obtained.
Thus, $.results(<label>)[0] is the first arguments passed to the callback.

3. We can use $j.results(<label>) in $j(fn).params().
The evaluation of $j.results(<label>) is earlier than $j.run(), so the result is not yet created,
but when $j.results is called in $j(fn).params(), it becomes a special object called KeyPath,
and it is re-evaluated in a running phase.

4. When $j.results is called in $j(fn).params(), we need to call like $j.results(<label>, key1, key2, ...)
to get $j.results(<label>)[key1][key2] in running phases.

**/

/** description(ja)

1. $j.results(<label>) で 指定されたラベルを持つ関数の結果を取得できます。同期関数なので戻り値が結果に格納されます。

2. 指定された関数が非同期関数の場合、コールバック関数の argumentsオブジェクトが取得されます。
なので、$.results(<label>)[0] が、コールバック関数に渡された第1引数となります。

3. $j.results(<label>) は、$j(fn).params() に渡しても通常どおり使う事ができます。
paramsに渡されるタイミングでは$j.run() は実行されていないので、本来なら結果はまだできていないはずなのですが、
渡されているときにはKeyPathという特殊なオブジェクトになっていて、実行時に評価されるようにしています。

4. 関数内では$j.results(<label>)[0] のように取得できましたが、paramsに渡すときは
$j.results(<label>, key1, key2, ...) のように指定することで $j.results(<label>)[key1][key2] が取得できます。

**/
