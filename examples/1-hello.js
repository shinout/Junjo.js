/** //
* en : When running in browsers, comment out this line.
* ja : ブラウザで実行する場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');

var $j = new Junjo(); //(1)

$j(function() {//(2)
  console.log('hello');
});

$j(console.log).params('world'); //(4)

$j.run(); //(3)

/** title
* en : get started
* ja : 基本的な使い方
**/

/** output

hello
world

**/

/** description(en)
1. Do $j = new Junjo() . Of course, any variable name is ok.

2. $j is a function.  $j(func) registeres a function named func.

3. $j is an object.   $j.run() executes registered functions.

4. params() ? wait... please wait, or guess what is happening!

**/

/** description(ja)

1. $j = new Junjo() します。 変数名$jはもちろん何でも構いません。

2. $j は関数です。 $j(func) でfuncという関数を登録します。

3. $j はオブジェクトです。 $j.run(); で登録した関数を実行します。

4. params() ? あとで説明するのでお待ちを。推測していただいて構いません。

**/
