if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {

  var $j = new Junjo();

	$j.register = function() {
		console.blue("===== override register ======");
		return Junjo.prototype.register.apply(this, arguments);
	}

  $j('labelseterr', function() {
    this.label('f');
  });

  $j('timeouterr', function() {
    this.timeout(3);
  });

  $j('nodecberr', function() {
    this.firstError();
  });

  $j('scoperr', function() {
    this.scope({});

  }).fail(function(e, args) {
    console.log("fail test");
    console.log(this.label() + " occurred an error -> " + e.message);
    return true;
  });

  $j('catcheserr', function() {
    this.catches('nodecberr');
  });

  $j('catchesAboveErr', function() {
    this.catchesAbove('nodecberr');
  });

  $j('afterErr', function() {
    this.after('nodecberr');
  });

  $j('afterAboveErr', function() {
    this.afterAbove('nodecberr');
  });

  $j.catchesAbove(function(e, args) {
    // console.error(e.stack);
    console.cyan(e.message + ' from ' + this.label());
    return true;
  });

  $j('1st', function(count) {
    if (!count) count = 1;
    console.log("--------------[COUNT : " + count + "]------------------");
    this.out.count = ++count;
    asyncMethod(this.label(), 10, this.cb);
    this.shared.hoge = "HogeHoge";
  });

  $j('2nd', function() {
    asyncMethod($j.current.label(), 20, $j.current.cb);
    console.log($j.current.shared.hoge);
    $j.shared.abc = "ABC";
  }).scope({hoge: 'FugaFuga'});

  $j.async('3rd', function() {
    asyncMethod(this.label(), 5, this.callback);
    console.log(this.shared.hoge);
    console.log(this.shared.abc);
    this.out[this.label()] = 'output result';
    console.log(this.out);
  }).after('1st');

  $j('4th', function() {
    asyncMethod(this.label(), 20, this.cb);
  }).after('2nd').async();

  $j('del', function() {
    console.log("DEL");
  });


  $j('5th', function() {
    asyncMethod(this.label(), 20, this.cb);
  }).after('1st', '2nd');

  $j('6th', syncMethod).params('6th').after('4th');

  $j('7th', asyncMethod).params('7th', 100, $j.cb).after();

  $j.remove('del');
  console.log("--------- del test----------");
  console.log($j.get('3rd').label());
  console.log($j.get('4th').label());
  console.log($j.get('5th').label());
  console.log($j.get('6th').label());
  console.log($j.get('7th').label());
  console.log("--------- end of del test----------");

  $j.async('8th', function() {
    syncMethod(this.label());
    this.cb(null, this.label() + " but synchronous"); // calling synchronously
  }).after('5th');

  $j.sync('9th', syncMethod).params('9th').after('5th');

  $j.sync(syncMethod).params($j.future.args(0)).after('9th');
  $j.sync(syncMethod).params($j.future.results('9th')).after('9th')
  .next('10th', function() {
    return syncMethod(this.label() + " using next()");
  });

  $j2 = new Junjo();
  $j2('11th', function(v) {
    console.log('subJunjo from ' + v);
    asyncMethod(this.label(), 20, this.callback);
  });

  $j2('12th', function(e, v) {
    syncMethod(this.label());
    this.out = v + ' ' + this.label() + ' subJunjo end';
  }).after('11th');

  $j($j2).after('10th')
  .next('13th', function() {
    asyncMethod(this.label(), 20, this.callback);
  });

  $j('last', function() {
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

  $j.catchesAbove(function(e, args) {
    console.red(e.message, this.label());
		return true;
  });

  $j.on('end', function(e, result) {
    consolelog("END", e, result);
    if (result.count < 3) $j.run(result.count);
  });

  $j.run();
}

