if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {

  var jj = new Junjo();

	jj.register = function() {
		console.log("===== override register ======");
		return Junjo.prototype.register.apply(this, arguments);
	}

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

  }).fail(function(e, jfn) {
    console.log("fail test");
    console.log(jfn.label() + " occurred an error -> " + e.message);
    return true;
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
    console.log("commons", jj.commons.shared.hoge);
    console.log(this.hoge);
    jj.commons.shared.abc = "ABC";
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

  jj('6th', syncMethod).params(jj.label).after('4th');

  jj('7th', asyncMethod).params(jj.label, 100, jj.callback).after();

  jj.remove('del');
  console.log("--------- del test----------");
  console.log(jj.get('3rd').label());
  console.log(jj.get('4th').label());
  console.log(jj.get('5th').label());
  console.log(jj.get('6th').label());
  console.log(jj.get('7th').label());
  console.log("--------- end of del test----------");


  jj.async('8th', function() {
    syncMethod(this.label());
    this.callback(null, this.label() + " but synchronous"); // calling synchronously
  }).after('5th');

  jj.sync('9th', syncMethod).params(jj.label).after('5th');

  jj.sync(syncMethod).params(jj.args(0)).after('9th');
  jj.sync(syncMethod).params(jj.results('9th')).after('9th')
  .next('10th', function() {
    return syncMethod(this.label() + " using next()");
  });

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

