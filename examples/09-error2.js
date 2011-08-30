/** //
* en : When running in browsers, comment out this line.
* ja : ブラウザで実行する場合、この行はコメントアウトして下さい.
**/
var Junjo = require('../Junjo');

var data = {
  fruits   : ['apple', 'banana'],
  place    : 'Tokyo',
  language : 'JavaScript',
  mountain : 'Mt. Fuji',
  music    : 'Stevie'
};

function getValueAsync(key, cb) {
  if (typeof key != 'string')  throw new Error('type of key must be string.');
  if (data[key] === undefined) throw new Error('key : ' + key + ' is not found.');
  setTimeout(function() {
    cb(data[key]);
  }, 0);
}

var $j = new Junjo(); 

function add() {
  Array.prototype.forEach.call(arguments, function(key) {
    $j('getter', getValueAsync).params(key, $j.callback).after().next(console.log);
  });
}

add('music', 'place');

$j.run();

/** title
* en : catching errors 2 : 
* ja : エラーを処理する 2: エラーフロー制御 
**/



/** output

**/


/** description(en)

1.

2.

3.

4.

5.

6.

**/

/** description(ja)

1.

2.

3.

4.

5.

6.



**/
