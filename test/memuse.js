var prevmem = 0;

function memdiff(n) {
  n = n || 1;
  while (n) {
    var cur = process.memoryUsage().heapUsed;
    console.log(cur - prevmem - 2576);
    prevmem = cur;
    n--;
  }
}

console.log('-------- load -----------');
memdiff(20);

console.log('-------- require es5-shim -----------');
var Junjo = require('../lib/es5-shim/es5-shim');
memdiff();
console.log('-------- require es5-shim end -----------');
memdiff(20);

console.log('-------- require Junjo -----------');
var Junjo = require('../Junjo');
memdiff();
console.log('-------- require Junjo end -----------');
memdiff(5);

console.log('-------- new Junjo -----------');
var i = 0, ar = [];
while (i < 24) {
  ar[i] = new Junjo();
  memdiff();
  i++;
}
var j = 0;

console.log('-------- new Junjo end -----------');
memdiff(5)
console.log('-------- new $Fn -----------');

while (j < 30) {
  ar[0](function() {
  });
  memdiff();
  j++;
}

console.log('-------- require umecob -----------');
var umecob = require('./umecob');
memdiff();
console.log('-------- require umecob end -----------');
var u = [];
memdiff(6);

console.log('-------- new umecob -----------');

var j = 0;
while (j < 30) {
  u.push(new umecob); 
  memdiff();
  j++;
}


