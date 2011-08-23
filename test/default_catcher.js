if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function junjo_test() {
  var jj = new Junjo({
    timeout : 3,
    catcher : function(e) {
      console.error(e);
      consolelog("Error!!!!!!!!but continue executing!!!!!");
      return ['firstArg', 'secondArg'];
    }
  });

  jj('1st', function() {
    this.shared.hoge = "HogeHoge";
    throw "II";
    asyncMethod(this.label(), 10, this.callback);
  });

  jj('2nd', function() {
    asyncMethod(jj.scope.label(), 20, jj.scope.callback);
    console.log(jj.scope.shared.hoge);
    console.log(this.shared.hoge);
    throw "II";
    jj.scope.shared.abc = "ABC";
  }).scope({hoge: 'FugaFuga'});

  jj('3rd', function() {
    asyncMethod(this.label(), 5, this.callback);
    console.log(this.shared.hoge);
    throw "II";
    console.log(this.shared.abc);
  }).after('1st');

  jj('4th', function() {
    asyncMethod(this.label(), 20, this.callback);
  }).after('2nd');

  jj('5th', function() {
    asyncMethod(this.label(), 20, this.callback);
    throw "II";
  }).after('1st', '2nd');

  jj('6th', syncMethod).params(jj.label).after('4th');

  jj('7th', asyncMethod).params(jj.label, 15, jj.callback).after();

  jj('8th', function() {
    asyncMethod(this.label(), 35, this.callback);
  }).after('5th');

  jj('last', function() {
    consolelog(Array.prototype.join.call(arguments, ' + '));
    asyncMethod(this.label(), 35, this.callback);
  }).afterAbove();

  jj.on('end', function() {
    consolelog("END");
  });

  jj.on('success', function() {
    consolelog("success");
  });

  jj.on('error', function() {
    consolelog("error end");
  });

  jj.run();
}
