var umecob = require('./umecob');

var u = new umecob({sync: true});;
var $j = u.run(__dirname + '/tpl.html', {
  hoge: "fad",
  afsd: "f"
});

if (typeof $j == 'function') {
  $j.next(function(err, out) {
    console.log(out);
  });
}
else {
  console.log($j);
}

console.log(Object.keys(umecob));
