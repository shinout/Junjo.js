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

  const J = (node) ? require('../Junjo') : Junjo;
  var jj = new J();

  jj('1st', function() {
    asyncMethod(this.label, 10, this.callback);
    this.hoge = "HogeHoge";
  }),

  jj('2nd', function() {
    asyncMethod(jj.scope.label, 20, jj.scope.callback);
    console.log(jj.scope.hoge);
    console.log(this.hoge);
    jj.scope.abc = "ABC";
  }).scope({hoge: 'FugaFuga'}),

  jj('3rd', function() {
    asyncMethod(this.label, 5, this.callback);
    console.log(this.hoge);
    console.log(this.abc);
  }).after('1st'),

  jj('4th', function() {
    asyncMethod(this.label, 20, this.callback);
  }).after('2nd'),

  jj('5th', function() {
    asyncMethod(this.label, 20, this.callback);
  }).after('1st', '2nd'),

  jj('6th', syncMethod).params(jj.label).after('4th'),

  jj('7th', asyncMethod).params(jj.label, 15, jj.callback).after(),

  jj('8th', function() {
    asyncMethod(this.label, 35, this.callback);
  }).after('5th'),

  jj('last', function() {
    consolelog(Array.prototype.join.call(arguments, ' + '));
    asyncMethod(this.label, 35, this.callback);
  }).afterAbove(),

  jj('ehandler', function(e, jfn) {
    consolelog(e.message, jfn.label);
		return false;
  }).catchesAbove()

  jj.on('end', function(e, r) {
    consolelog("END", e, r);
  });

  jj.on('terminate', function(e, r) {
    consolelog("terminated!", e, r);
  });

  jj.run();
}

if (node) { junjo_test();}
