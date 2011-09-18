/** //
* en : When running in browsers, comment out this line.
* ja : ブラウザで実行する場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');
var $j = new Junjo();

$j('foo', function() { // (1)
  console.log(this.label); // (2)
  return this.label;
});

$j('bar', function() {
  console.log(this.label);
  return this.label;
});

$j(function() {
  console.log(this.label); // (3)
  return this.label;  // 2
});

$j(function(v1, v2, v3) {
  console.log('previous labels: ' + v1, v2, v3);
}).after('foo', 'bar', 2); // (4)

$j.run();


/** title
* en : set the label to functions
* ja : 関数にラベルをつける
**/


/** output

foo
bar
2
previous labels: foo bar 2

**/

/** description(en)

1. If type of the first argument of $j() is string, then it is set as a label of the function.

2. We can get the label of the function by "this.label" in the function.

3. If a label was not set, a serial number is set as a label in registration. 

4. Labels are available in $j().after(<label name>) and so on.

**/

/** description(ja)

1. $j() の第1引数が文字列の場合、それがその関数のラベルとなります。

2. ラベルは関数のなかで this.label でアクセスできます。

3. ラベルが設定されていない場合、登録時の順番(0から始まる)がラベルとなります。

4. ラベルはafter() などの関数で使う事ができます。

**/
