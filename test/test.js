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
  var jj = new J();

  jj('labelseterr', function() {
    this.label('f');
  });

  jj('timeouterr', function() {
    this.timeout(3);
  });

  jj('nodecberr', function() {
    this.nodeCallback();
  });

  jj('scoperr', function() {
    this.scope({});
  });

  jj('catcheserr', function() {
    this.catches('nodecberr');
  });

  jj('catchesAboveErr', function() {
    this.catchesAbove('nodecberr');
  });

  jj('afterErr', function() {
    this.after('nodecberr');
  });

  jj('afterAboveErr', function() {
    this.afterAbove('nodecberr');
  });

  jj.catchesAbove(function(e, jfn) {
    console.error(e.message + ' from ' + jfn.label());
    return true;
  });

  jj('1st', function(count) {
    if (!count) count = 1;
    console.log("--------------[COUNT : " + count + "]------------------");
    this.out.count = ++count;
    asyncMethod(this.label(), 10, this.callback);
    this.shared.hoge = "HogeHoge";
  });

  jj('2nd', function() {
    console.log(jj.current);
    asyncMethod(jj.current.label(), 20, jj.current.callback);
    console.log(jj.current.shared.hoge);
    console.log(this.hoge);
    jj.current.shared.abc = "ABC";
  }).scope({hoge: 'FugaFuga'});

  jj.async('3rd', function() {
    asyncMethod(this.label(), 5, this.callback);
    console.log(this.shared.hoge);
    console.log(this.shared.abc);
    this.out[this.label()] = 'output result';
    console.log(this.out);
  }).after('1st');

  jj('4th', function() {
    asyncMethod(this.label(), 20, this.callback);
  }).after('2nd').async();

  jj('del', function() {
    console.log("DEL");
  });


  jj('5th', function() {
    asyncMethod(this.label(), 20, this.callback);
  }).after('1st', '2nd');

  jj('6th', syncMethod).params(jj.label).after('4th'),

  jj('7th', asyncMethod).params(jj.label, 100, jj.callback).after(),

  jj.remove('del');
  console.log("--------- del test----------");
  console.log(jj.get('3rd').label());
  console.log(jj.get('4th').label());
  console.log(jj.get('5th').label());
  console.log(jj.get('6th').label());
  console.log(jj.get('7th').label());
  console.log("--------- end of del test----------");


  jj.async('8th', function() {
    asyncMethod(this.label(), 35, this.callback);
  }).after('5th');

  jj.sync('9th', syncMethod).params(jj.label).after('5th');

  jj.sync('10th', syncMethod).params(jj.args(0)).after('9th');
  jj.sync('11th', syncMethod).params(jj.results('10th')).after('9th');

  jj('last', function() {
    var args = Array.prototype.map.call(arguments, function(v) {
      switch (v) {
        case undefined: return 'undefined';
        case null: return 'null';
        default: return v;
      }
    });

    consolelog(args.join(' + '));
    asyncMethod(this.label(), 35, this.callback);
  }).afterAbove();

  jj.catchesAbove(function(e, jfn) {
    consolelog(e.message, jfn.label());
		return true;
  });

  jj.on('end', function(e, result) {
    consolelog("END", e, result);
    if (result.count < 3) jj.run(result.count);
  });

  jj.on('terminate', function(e, r) {
    consolelog("terminated!", e, r);
  });

  jj.run();
}

if (node) { junjo_test();}
