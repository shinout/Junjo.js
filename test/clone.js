if (typeof global != 'undefined') require('./load.test').load(global);
if (node) junjo_test();

function asy(color, name, n, cb, e) {
  console.color(color, name);
  setTimeout(function() {
    console.color(color, '\t' + name + ' + ' + n + ' [sec]');
    cb(e || null, name);
  }, n);
}

// test start
function junjo_test() {

  var $j = new Junjo({after: true});
  $j('1st', function(color) {
    this.$.col = color;
    asy(this.$.col, this.label, 50, this.callback);
    T.ok( this.$.col == (this.junjo === $j) ? 'green' : 'purple', "two junjo objs");
  });

  $j('2nd', function() {
    asy(this.$.col, this.label, 1, this.callback);
  });

  $j('3rd', function() {
    asy(this.$.col, this.label, 2, this.callback);
  });

  $j('4th', function() {
    asy(this.$.col, this.label, 10, this.callback);
  });

  $j('5th', function() {
    asy(this.$.col, this.label, 100, this.callback);
  }).after();

  $j('6th', function() {
    asy(this.$.col, this.label, 20, this.callback);
  }).after();

  $j('7th', function() {
    asy(this.$.col, this.label, 10, this.callback);
  }).after('2nd', '3rd');

  $j.run("green");
  setTimeout(function() {
    $j.clone().run("purple");
  }, 100);
}