/** //
* en : if not running with Node.js, comment out this line.
* ja : Node.jsで実行しない場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');
var $j = new Junjo();

$j(function(n) {
  return ++n;
});

$j(function(n) {
  return ++n;
}).after();

$j(function(n) {
  return ++n;
}).after();

$j(function(v1, v2, v3) {
  console.log(v1, v2, v3, v1 + v2 + v3);
}).afterAbove(); // (1)

$j(function(n) { // (2)
  console.log(n + 100);
  return n + 100;
});

$j.run(0);


/** title
* en : after all the registered function
* ja : 登録されている関数すべての後に実行
**/


/** output
1 2 3 6
100
**/


/** description(en)

1. With $j(fn).afterAbove() , fn is executed after all the registered functions.

2. No effect to the functions registered after $j(fn).afterAbove() .

**/

/** description(ja)

1. $j(fn).afterAbove() で、すでに登録された関数すべてにafter()をして登録します。

2. $j(fn).afterAbove() の後に登録された関数には影響ありません。

**/
