var Junjo = require('../Junjo');
var $j    = new Junjo();
var fs    = require('fs');
var exec  = require('child_process').exec;
var ignores = [
  'load.test.js',
  'all.js',
  'umecob.js',
  'jshint.js',
  'memuse.js'];

// 1. get test files
$j('files', function() {
  fs.readdir(__dirname, this.cb);
})
.firstError('shift')
.post(function(files) {
  // filter unnecessary files
  return files.filter(function(v) {
    return v.slice(-3) == '.js' && ignores.indexOf(v) < 0;
  });
});


$j('exec', function(files) {
  files.forEach(function(file, k) {
    exec([process.argv[0], __dirname + '/' + file].join(' '), this.callbacks(file));
  }, this);
})
.after()
.reduce(function(result, args, filename) {
  console.log('------------------------------------[' + filename + ']------------------------------------'); 
  if (args[0]) console.error(args[0]); 
  console.log(args[1]); 
});

$j.run();
