var node = (typeof exports == 'object' && exports === this);

// test start
function junjo_test() {
  function asyncMethod(name, n, cb) {
    consolelog(name);
    setTimeout(function() {
      consolelog('\t' + name + ' + ' + n + ' [sec]');
      cb(null, name);
    }, n);
  }

  function syncMethod(name) {
    consolelog(name);
    consolelog('\t' + name + ' (sync)');
    return name + ' (sync)';
  }
 
  function consolelog() {
    if (node) {
      console.log.apply(this, arguments);
    }
    else {
      Array.prototype.forEach.call(arguments, function(v) {
        console.log(v);
        var el = document.createElement('li');
        el.innerHTML = v.toString();
        document.getElementById('test').appendChild(el);
      });
    }
  }

  var J = (node) ? require('../Junjo') : Junjo;
  var j1 = new J();

  j1('1st', function() {
    asyncMethod(this.label(), 10, this.callback);
    this.shared.hoge = "HogeHoge";
  });

  j1('2nd', function(err, val) {
    this.out = 'val=' + val + '&hoge=' + this.shared.hoge + '&val2=' + this.label();
  }).after();

  var j2 = new J().after(j1);
  
  j2('3rd', function(err, val) {
    return val + ' (from j1), ' + this.label();
  });

  j2('4th', function(val) {
    this.out = val + ' and ' + this.label();
  }).after();

  j2.on('end', function(err, val) {
    console.log(err, val);
  });

  j1.run(); // j2 runs too.
}

if (node) { junjo_test();}
