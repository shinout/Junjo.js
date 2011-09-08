var http         = require('http');
var umecob       = require('../test/umecob');
var Junjo        = require('../Junjo');
var fs           = require('fs');
var docdir       = __dirname + '/../docs'
var exparser     = require('./exparser');
var StaticHoster = require('./lib/StaticHoster');
var staticHoster = new StaticHoster(__dirname + '/../docs/public');

umecob.data_getters['code'] = {
  async : function(id, callback) {
    var $j = new Junjo({run: true});

    $j(fs.readFile)
    .bind(fs, __dirname + '/../examples/' + id + '.js', $j.cb)
    .firstError(true);

    $j(function(err, result) {
      this.out = exparser(result.toString());
    })
    .after();

    $j.on('end', callback);
  }
};

http.createServer(function(req, res) {
  if (staticHoster.host(req, res, true)) return;

  var lang = 'ja';


  var $j = umecob({
    tpl_id  : docdir + '/doc.html',
    data_id : docdir + '/' + lang +'.lang',
    attach  : {
      docdir  : docdir,
      examples: ['01-hello', '02-async', '03-label', '04-after', '05-params',
                 '06-results', '07-afterAbove', '08-error1', '09-error2']

    }
  });

  $j.on('end', function(err, out) {
    res.writeHead(200, {'Content-Type' : 'text/html'});
    console.log(out);
    res.end(out);
  });
})
.listen(1192);
