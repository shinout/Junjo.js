var node = (typeof exports == 'object' && exports === this);

// test start
function junjo_test() {
  function asyncMethod(name, n, cb) {
    console.log(name);
    setTimeout(function() {
      console.log('\t' + name + ' + ' + n + ' [sec]');
      cb(null, name);
    }, n);
  }

  function syncMethod(name) {
    console.log(name);
    console.log('\t' + name + ' (sync)');
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

  jj.register(
    jj('1st', function() {
      asyncMethod(this.label(), 10, this.callback);
    }),

    jj('2nd', function() {
      asyncMethod(this.label(), 20, this.callback);
    }),

    jj('3rd', function() {
      asyncMethod(this.label(), 5, this.callback);
    }).after('1st'),

    jj('4th', function() {
      asyncMethod(this.label(), 20, this.callback);
    }).after('2nd'),

    jj('5th', function() {
      asyncMethod(this.label(), 20, this.callback);
    }).after('1st', '2nd'),

    jj('6th', function() {
      syncMethod(this.label());
    }).after('4th'),

    jj('7th', function() {
      asyncMethod(this.label(), 15, this.callback);
    }).after('6th'),

    jj('8th', function() {
      asyncMethod(this.label(), 35, this.callback);
    }).after('5th'),

    jj('last', function() {
      asyncMethod(this.label(), 35, this.callback);
    }).after('1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th')
  );

  jj.on('end', function() {
    console.log("END");
  });

  jj.on('success', function() {
    console.log("success");
  });

  jj.run();
}

if (node) { junjo_test();}
