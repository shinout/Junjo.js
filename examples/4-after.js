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
    callback(v, n); // (*)
  }, n);
}

var $j = new Junjo();

$j('foo', function() {
  console.log(this.label());
  return this.label(); // (%)
});

$j('bar', function() {
  asyncFunc(this.label(), 40, this.callback);
});


$j('hoge', function(prev_label, prev_num) { // (3)
  console.log('prev_label : ' + prev_label);
  console.log('prev_num: ' + prev_num);

  asyncFunc(this.label(), 10, this.callback);
}).after(); // (1)

$j('fuga', function(lbl1, num1, lbl2) { // (4)
  asyncFunc(this.label(), 10, this.callback);

  console.log('prev_label1 : ' + lbl1); 
  console.log('prev_num1: ' + num1); 
  console.log('prev_label2 : ' + lbl2); 

}).after('bar', 'foo'); // (2)

$j(function() {
  asyncFunc('A->', 10, this.callback);
})
.next(function(v, n) { // (5)
  console.log('B :' + n);
});

$j.run();


/** title
* en : set the executing order
* ja : 関数の実行順序を設定する
**/


/** output

foo
bar:begin

A->:begin

A->:end [10 sec]

B :10
bar:end [40 sec]

prev_label : bar
prev_num: 40
hoge:begin

fuga:begin

prev_label1 : bar
prev_num1: 40
prev_label2 : foo
hoge:end [10 sec]

fuga:end [10 sec]

**/

/** description(en)

1. We can set the executing order by $j(fn).after(). If no arguments are passed to after(), 
then the function fn is executed after the previously registered function.

2. If we call $(fn).after(<label1>, <label2> ...), the function fn is executed after 
all the functions named <label1>, <label2> ... are finished.

3. The function with after() is passed arguments. These are the callback arguments if the previous function is asynchronous,
returned value if the previous function is synchronous.

4. The arguments passed to the function with multiple after labels are, concatination of the callback arguments if the previous function is asynchronous,
returned value if the previous function is synchronous, for each label by the passed order.

5. We can also set an order by $j(fn1).next(fn2), which is the same meaning as $j(fn1); $j(fn2).after();

**/

/** description(ja)

1. $j(fn).after() で、実行順序を設定できます。afterに引数を与えない時、直前に登録された関数の後に実行されます。

2. $j(fn).after(<label1>, <label2> ...) と指定すると、関数fnは指定されたラベルを持つ関数すべてが完了してから実行されます。

3. afterを付けた関数には引数が渡されます。それは、非同期関数ならコールバックの引数(*), 同期関数なら戻り値(%)です。

4. afterを複数つけた関数に渡される引数は、設定したラベル順に、非同期関数ならコールバックの引数(*), 同期関数なら戻り値(%)です。

5. $j(fn1).next(fn2) は, $j(fn1); $j(fn2).after() と同じ意味です。

**/
