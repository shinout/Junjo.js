if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {

  var $j = new Junjo();

	$j.register = function() {
		console.blue("===== override register ======");
		return Junjo.prototype.register.apply(this, arguments);
	}

  $j('1st', function(count) {
    console.log("--------------[COUNT : " + count + "]------------------");
    this.out.count = ++count;
    asyncMethod(this.label, 10, this.cb);
    this.$.hoge = "HogeHoge";
  });

  $j('2nd', function() {
    asyncMethod($j.current.label, 20, $j.current.cb);
    T.equal($j.current.$.hoge, 'HogeHoge');
    $j.$.abc = "ABC";
  }).scope({hoge: 'FugaFuga'});

  $j.async('3rd', function() {
    asyncMethod(this.label, 5, this.callback);
    T.equal(this.shared.hoge, 'HogeHoge');
    T.equal(this.shared.abc, 'ABC');
    this.out[this.label] = 'output result';
    T.equal($j.out['3rd'], 'output result');
  }).after('1st');

  $j('4th', function() {
    asyncMethod(this.label, 20, this.cb);
  }).after('2nd').async();

  $j('del', function() {
    console.log("DEL");
  });


  $j('5th', function() {
    asyncMethod(this.label, 20, this.cb);
  }).after('1st', '2nd');

  $j('6th', syncMethod).params('6th').after('4th');

  $j('7th', asyncMethod).params('7th', 100, $j.cb).after();

  $j.remove('del');
  T.equal($j.get('3rd').label, '3rd');
  T.equal($j.get('4th').label, '4th');
  T.equal($j.get('5th').label, '5th');
  T.equal($j.get('6th').label, '6th');
  T.equal($j.get('7th').label, '7th');

  $j.async('8th', function() {
    T.equal(this.inputs.length, 1, "inputs");
    this.inputs[0] = "JJJJJJ";
    T.equal(this.inputs.length, 1, "inputs");
    syncMethod(this.label);
    this.cb(null, this.label + " but synchronous"); // calling synchronously
  }).after('5th')
  .post(function(e, o) {
    T.equal(o, '8th but synchronous');
    return Junjo.multi(e, o);
  });

  $j.sync('9th', syncMethod).params('9th').after('5th');

  $j.sync(syncMethod).params($j.future.args(0)).after('9th');
  $j.sync(syncMethod).params($j.future.results('9th')).after('9th')
  .next('10th', function() {
    return syncMethod(this.label + " using next()");
  });

  $j2 = new Junjo();
  $j2('11th', function(v) {
    T.equal(v, "10th using next() (sync)");
    asyncMethod(this.label, 20, this.callback);
  });

  $j2('12th', function(e, v) {
    syncMethod(this.label);
    this.out = v + ' ' + this.label + ' subJunjo end';
  }).after('11th');

  $j($j2).after('10th')
  .next('13th', function() {
    T.equal(arguments[1], "11th 12th subJunjo end");
    asyncMethod(this.label, 20, this.callback);
  });

  $j('last', function() {
    T.equal(arguments.length, 23);
  }).afterAbove();

  $j.catchesAbove(function(e, args) {
    T.fail(e);
    console.red(e.message, this.label);
		return true;
  });

  $j.on('end', function(e, result) {
    consolelog("END", e, result);
    if (result.count < 3) $j.run(result.count);
  });

  $j.run(1);
}

