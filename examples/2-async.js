/** //
* en : if not running with Node.js, comment out this line.
* ja : Node.jsで実行しない場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');

/** ** 
* en : (an asynchronous function which execute a callback function after the whole process.
* ja : 処理完了後にcallbackを実行する非同期な関数 
**/
function asyncFunc(v, n, callback) {
  console.log(v + ':begin\n');

  setTimeout(function() {
    console.log(v + ':end [' + n + ' sec]\n');
    callback();
  }, n);
}

var $j = new Junjo();

$j(function() {
  asyncFunc('hello', 40, this.callback); //(1,2)
});

$j(function() {
  asyncFunc('world', 20, this.callback); //(1,2)
});

$j(asyncFunc).params('after world', 30, $j.callback).after(); //(3,4)
$j.run(); 

/** title
* en : manage asynchronous functions
* ja : 非同期関数を扱う
**/

/** output

hello:begin

world:begin

world:end [20 sec]

after world:begin

hello:end [40 sec]

after world:end [30 sec]

**/

/** description(en)

1. "hello" and "world" functions are executed in parallel.

2. pass "this.callback" to asynchronous function as a callback.

3. "after world" is executed after "world" callback is called,
because it uses after(), which make the function execute after the previously registered function.

4. $j.callback ? wait... please wait, or guess what is happening!

**/

/** description(ja)

1. "hello" と "world" の関数は 並列で実行されます.

2. 非同期関数へのコールバックには、 this.callback を渡します.

3. "after world"はworldが終わったあとに実行されます. after() を付けているためです.
after()をつけると直前に登録された処理が終わったあとに実行されます。

4. $j.callback ? あとで説明するのでお待ちを。推測していただいて構いません。

**/
