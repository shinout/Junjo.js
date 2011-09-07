/**
 * TODO cope with directory traversal vulnerablity problem
 *
 **/
const path  = require('path');
const fs    = require('fs');
const Junjo = require('../../Junjo');

function StaticHoster(public_path, mimes) {
  this.public_path = public_path || process.cwd();
	this.mimes = {
    css       : ['text/css', 'css'],
    js        : ['text/javascript', 'js'],
    png       : ['image/png', 'images'],
    jpg       : ['image/jpeg', 'images'],
    gif       : ['image/gif', 'images'],
    ico       : ['image/vnd.microsoft.icon', ''],
    manifest  : ['text/cache-manifest', '']
	};
	if (typeof mimes == 'object') {
		for (var i in mimes) {
			this.mimes[i] = mimes[i];
		}
	}
}

StaticHoster.prototype.host = function(req, res, sync) {
  var $j = new Junjo({result : true});
  var self = this;

  $j(function() {
    this.out     = false;
    var ext      = path.extname(req.url).slice(1);
    var urlElems = req.url.split('/');
    urlElems.shift();

    var mimeInfo = self.mimes[ext];

    if (!mimeInfo) {
      $j.terminate();
      return;
    }

    if (mimeInfo[1] && urlElems[0] != mimeInfo[1]) { throw new Error() }
    return mimeInfo[0];
  });

  $j(function(mimetype) {
    var path = self.public_path + req.url;
    if (sync) return fs.readFileSync(path);
    return fs.readFile(self.public_path + req.url, this.cb);
  })
  .after();

  $j(function(mimetype) {
    var contents = (arguments.length == 3) ? arguments[2] : arguments[1];
    res.writeHead(200, {'Content-Type' : mimetype });
    res.end(contents);
    this.out = true;
  })
  .afterAbove();

  $j.catchesAbove(function(e) {
    res.writeHead(404, {'Content-Type' : 'text/plain' });
    res.end('404 not found');
  });
  
  return $j.run();
};

module.exports = StaticHoster;
