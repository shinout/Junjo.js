if (typeof require == 'function') var Junjo = require('../Junjo');
var N = 0; console.time(N);
function showTime(v) { console.log(v); console.timeEnd(N); console.time(++N); }

/**
 * params to pass to the umecob.js
 *
 * tpl_id       (mixed)
 *              the identifier to get a template
 *              e.g.  '/var/www/umecob.net/templates/foo.tpl'
 *                    '/tpls/bar.tpl'
 *                    'hoge'
 *                    { name : 'fuga' }
 *
 * tpl_getter   (string or object)
 *              converter. tpl_id => tpl
 *
 *              you specify the converter with its name (string) or your own object.
 *              <The interface of converter object>
 *              { sync  : function((mixed) tpl_id) returns (string) tpl,
 *                async : function((mixed) tpl_id, callback) 
 *                             callback arguments : [0] => error 
 *                                                  [1] => tpl
 *              }
 *
 *              <the converters with name>
 *                file : requires a file path as tpl_id, only available in Node.js
 *                ajax : requires an URI as tpl_id, only available in browsers
 *
 * tpl          (string)
 *              template.
 *              e.g.  '<%= hoge %> World!'
 *
 *
 * data_id      (mixed)
 *              the identifier to get a data
 *              e.g.  '/apis/records/1'
 *                    '/var/www/umecob.net/data/data.json'
 *                    {table : 'piyo', id : 23}
 *
 * data_getter (string or object)
 *
 * data         (object)
 *              data to set to the template
 *              e.g.  { hoge : 'Hello,' }
 *
 * sync         (boolean)
 *              if true, execute synchronously and return the rendered value.
 *              e.g.  var result = umecob({sync : true, tpl : "${hoge}", data: {hoge : 'Hi!'}}); // Hi!
 *
 * starts       (Array of functions) 
 *              executed before all the process start.
 *              Functions are executed in the registered order.
 *         
 *
 * compiler     (string or object)
 *
 * delims       (Array[string, string])
 *
 **/
function umecob() {
  var params = umecob.parseArgs.apply(null, arguments);
  if (!this instanceof umecob) return umecob.run(params);
  this.params = params;
}

/**
 * run
 **/
umecob.prototype.run = function() {
  var params = umecob.parseArgs.apply(null, arguments);
  if (!this.params) this.params = {};
  Object.keys(this.params).forEach(function(k) {
    if (params[k] instanceof Array && this.params[k] instanceof Array) {
      params.concat(this.params[k]);
    }
    else {
      if (params[k] === undefined) params[k] = this.params[k];
    }
  }, this);
  params.umecob || (params.umecob = this);

  return umecob.run(params);
};

/**
 * parse arguments
 **/
umecob.parseArgs = function() {
  var params = {};
  if (arguments.length >= 2) {
    if (typeof arguments[2] == 'object') params = arguments[2];
    params.tpl_id = arguments[0];
    var d = arguments[1];
    params[ (typeof d == 'object') ? 'data' : 'data_id' ] = d;
  }
  else {
    params = arguments[0];
  }
  return params;
};

/**
 * implementation of run  (should be private)
 **/
umecob.run = function(params) {

  $j = new Junjo({ result : !!params.sync });

  $j('startValidator', function(params) {
        showTime("startValidator");
    this.shared.params = params;
    return params.starts.filter(function(fn) { return typeof fn == 'function' });
  })
  .fail(function(e) { return [[]] });

  $j('starts', function(starts) {
        showTime("starts");
    starts.forEach(function(fn) {
      this.shared.params = fn.apply(this.shared.params);
    });
  }).after('startValidator');

  $j('inputValidator', function() {
        showTime("inputvalidator");
    var params = this.shared.params;
    if (params.result) {
      this.out = params.result;
      // $j.terminate();
      $j.skip('tpl_getter', params.tpl);
      $j.skip('tpl', params.tpl);
      $j.skip('data_getter', params.data);
      $j.skip('data', params.data);
      $j.skip('render', params.result);
    }

    ['tpl_getter', 'data_getter', 'compiler'].forEach(function(k) {
      if (typeof params[k] == 'object') {
        // 
      }
      else if ( typeof params[k] == 'string' && umecob[k + 's'][params[k]]) {
        params[k] = umecob[k + 's'][params[k]];
      }
      else {
        params[k] = umecob.defaults(k);
      }
    });

    if (!(params.ends instanceof Array)) {
      params.ends = [];
    }

    return params;
  })
  .after('starts')
  .fail(function(e) {
    console.log(e.stack);
    $j.terminate();
    return false;
  });

  $j('tpl_getter', function(params) {
        showTime("tpl_getter");
    if (params.code) {
      $j.skip('compile', params.code);
      return params.tpl;
    }
    if (params.tpl)  return params.tpl;
    if (params.sync) {
      return params.tpl_getter.sync(params.tpl_id);
    }
    else {
      params.tpl_getter.async(params.tpl_id, this.cb);
    }
  })
  .nodeCallback(true)
  .after('inputValidator')
  .fail(function(e, $fn) {
    this.out = e.message;
    $j.terminate();
  })
  .next('compile', function() {
        showTime("compile");
    var params  = this.shared.params;
    params.tpl  = umecob.unifySyncAsync(arguments);
    params.code = params.compiler(params);
  });


  $j('data_getter', function(params) {
        showTime("data_getter");
    if (params.data) return params.data;
    if (!params.data_id) return {};
    if (params.sync) {
      return params.data_getter.sync(params.tpl_id);
    }
    else {
      params.data_getter.async(params.data_id, this.cb);
    }
  })
  .nodeCallback(true)
  .after('inputValidator')
  .fail(function(e, $fn) {
    this.out = e.message;
    $j.terminate();
  })
  .next('data',  function() {
    this.shared.params.data = umecob.unifySyncAsync(arguments);
  });

  $j('render', function() {
        showTime("render");
    var params = this.shared.params;
    var r = umecob.render(params);
    if (r.constructor == Junjo)
      this.sub = r;
    else 
      return r;
  })
  .after('compile', 'data')
  .next('ends', function() {
    var params = this.shared.params;
    params.result = umecob.unifySyncAsync(arguments);
    var params = this.shared.params;
    params.ends.forEach(function(fn) { fn.apply(params) });
    this.out = params.result;
  });
  showTime("beforeRun");

  return $j.run(params);
};

/**
 * is node or not
 **/
umecob.node = (typeof exports == 'object' && exports === this);

/**
 * unify synchronous / asynchronous function
 **/
umecob.unifySyncAsync = function(args) {
  return (args.length > 1) ? args[1] : args[0];
};

/**
 * contents getters
 **/
umecob.log = function(v){ console.log(v) };

/**
 * contents getters
 **/
umecob.getters = {};

if (umecob.node) {
  /**
   * file getter
   **/
  var fs = require('fs');
  umecob.getters.file = {
    sync : function(id) {
      return fs.readFileSync(id).toString();
    },
    async : function(id, callback) {
      return fs.readFile(id, function(e, o) {
        callback(e, e ? o : o.toString());
      });
    }
  }
}
else {
  /**
   * ajax getter
   **/
  umecob.Request = function() {
    return typeof(ActiveXObject) !== "undefined"   
      ? new ActiveXObject("Msxml2.XMLHTTP") || new ActiveXObject("Microsoft.XMLHTTP")
      : new XMLHttpRequest();
  };

  umecob.getters.ajax = {
    sync : function(id) {
      var request = new umecob.Request();
      request.open("GET", id, false);
      if ( request.status == 404 || request.status == 2 ||(request.status == 0 && request.responseText == '') ) return "";
      return request.responseText;
    },
    async : function(id, callback) {
      var request = new umecob.Request();
      request.onreadystatechange = function() {
        if(request.readyState == 4){
          callback(null, request.responseText);
        }
      }
      request.open("GET", id);
      request.send(null);
    }
  }
}

umecob.tpl_getters  = umecob.getters;
umecob.data_getters = umecob.getters;

/**
 * defult params
 **/
umecob.defaults = function(k) {
  switch (k) {
    case 'tpl_getter'  :
    case 'data_getter' :
      return umecob.getters[(umecob.node) ? 'file' : 'ajax'];
    case 'compiler' :
      return umecob.compilers.jsp;
  }
};

/**
 * scope for eval()
 **/
umecob.eval = function(echo, code) { return eval(code); }

/**
 * evaluate for JSHINT()
 **/
umecob.evalScope = function(echo) {
  with(echo.data) {
    for (var i in this.errors) {
      try {
        var t = typeof eval(this.errors[i].a);
      }
      catch(e) {
        var t = "undefined";
      }
      if (t  === "undefined") { return { line: this.errors[i].line, reason: this.errors[i].reason }; }
    }
  }
  return false;
};

/**
 * Array-like character Buffer (faster than Array)
 **/
umecob.Buffer = function() { this.init(); };
umecob.Buffer.prototype.init      = function(i, c) { this.i = 0; this.arr = new Array(); };
umecob.Buffer.prototype.add       = function(c) { this.arr[this.i++] = c; };
umecob.Buffer.prototype.push      = umecob.Buffer.prototype.add;
umecob.Buffer.prototype.pop       = function() { this.i--; return this.arr.pop() };
umecob.Buffer.prototype.join      = function(sep) { return this.arr.join(sep || ''); };
umecob.Buffer.prototype.getIndex  = function() { return this.i; };
umecob.Buffer.prototype.increment = function() { this.i++; };
umecob.Buffer.prototype.get       = function(i) { return this.arr[i]; };
umecob.Buffer.prototype.put       = function(i, c) { this.arr[i] = c; };
umecob.Buffer.prototype.clear     = umecob.Buffer.prototype.init;

/**
 * render
 **/
umecob.render = function(params) {
  var buff = new umecob.Buffer();
  var echo = function(txt) { buff.add(txt) };

  var $j = new Junjo().on('end', function(err, out) {
    var results = $j.results();
    Object.keys(results).forEach(function(label) {
      echo.put(label, umecob.unifySyncAsync(results[label]));
    });
    this.out = echo.getText();
  });

  echo.params    = params;
  echo.sync      = params.sync || false;
  echo.umecob    = params.umecob || new umecob();
  echo.umecob.params.sync = echo.sync;
  echo.data      = params.data;
  echo.addJunjo  = function(fn) { $j.register(buff.getIndex(), fn); buff.increment() };
  echo.addUmecob = function(um) { ( um instanceof Junjo) ? echo.addJunjo(um) : echo(um) };
  echo.put       = function(i, v) { buff.put(i, v) };
  echo.getText   = function() { return buff.join() };
  echo.getResult = function() {
    return (echo.sync) ? echo.getText() : $j.run();
  };
  try {
    return umecob.eval(echo, params.code);
  } catch (e) {
    var code4lint = params.code.replace(/->#JH#(\n|.)*?<-#JH#/g, '').split("\n");
    var tplname = params.tpl_id || ((typeof params.tpl == "string") 
      ? "template :  >>> " + params.tpl.substr(0, 50).replace(/\n/g, " ") + "...  "
      : "compiled code: >>> " + params.code.substr(76, 50).replace(/\n/g, " "));

    var hint = umecob.JSHINT(code4lint.join("\n"), e);

    if (!hint) {return e.stack || e.message || e;}
    var result = umecob.evalScope.call(hint, echo);
    if (!result) {
      umecob.log(e.stack || e.message || e);
      umecob.log("Something is wrong with "+ tplname);
      return e.message || e;
    }
    var code = (typeof params.tpl == 'string') ? params.tpl.replace(/\n$/, '').split("\n") : code4lint;
    var reason = result.reason + "  in " + tplname;
    return umecob.showCode(code, reason, result.line, e);
  }

};

/* hint: show error in detail using JSHINT */
umecob.JSHINT = function(code, e) {
  var option = {
    maxerr   : 10000000,
    browser  : true,
    undef    : true,
    boss     : true,
    evil     : true,
    devel    : true,
    asi      : true,
    forin    : true,
    jquery   : true,
    node     : true,
    on       : true,
    laxbreak : true
  }
  JSHINT = (typeof JSHINT == "function") ? JSHINT : (umecob.node ? require("./jshint.js") : null);
  if (!JSHINT) {
    return null;
  }
  JSHINT(code, option);
  return JSHINT;
}

umecob.showCode = function(arr, reason, line, e) {
  var code4disp = [];
  var k = Math.max(line - 10, 0);
  var limit = Math.min(arr.length, line + 10);
  while(k < limit) {
    code4disp.push( (k == line -1 ? "*" : " ") +  (parseInt(k)+1) + "\t"+arr[k]);
    k++;
  }
  var err = reason + " at line " + line + '.';
  umecob.log(err);
  umecob.log("//------------------------------------//\n" +
             "//-------------- start ---------------//\n" +
                        code4disp.join("\n")       + "\n" +
             "//--------------- end ----------------//\n" +
             "//------------------------------------//\n");
  umecob.log(e.stack || e.message || e);
  return err;
};

(function() {
  var i = 1,
      START                = i++,
      JS_PRE_START         = i++,
      JS_START             = i++,
      JS_WAITING_COMMAND   = i++,
      JS_PRE_END           = i++,
      JS_ECHO              = i++,
      JS_ECHO_PRE_END      = i++,
      PRE_SHORT_ECHO       = i++,
      SHORT_ECHO           = i++,
      ESCAPING             = i++,
      QS_SHORT_ECHO        = i++,
      ALTERNATE_SHORT_ECHO = i++,
      INSIDE_DQ            = i++,
      INSIDE_SQ            = i++,
      JS_PRE_COMMENT       = i++,
      JS_MCOMMENT          = i++,
      JS_PRE_ENDMCOMMENT   = i++,
      JS_ESCAPE            = i++,
      JS_INCLUDE           = i++,
      JS_INCLUDE_PRE_END   = i++,
      JS_ASYNC             = i++,
      JS_ASYNC_PRE_END     = i++,
      FINISH_JS            = i++;

  /**
   * default compiler
   **/
  umecob.defaultCompiler = function(delims, params) {
    var tpl = params.tpl,
        tplArr = (typeof tpl === "string")  ? (tpl.replace(/\r(\n)?/g, '\n').replace(/\0/g, '').replace(/\n$/, '') + '\0').split("") : '\0',
        i      = 0,
        len    = tplArr.length,
        parser = new Parser(delims);

    parser.addCode("/*->#JH#*/with(echo.data){/*<-#JH#*/");

    try {
      while (i < len && !parser.end) {
        parser.parse(tplArr[i++]);
      }
    } catch (e) {
      umecob.log("error in " + (params.tpl_id || params.tpl || params.code));
      umecob.log(e.stack);
    }

    parser.addCode("\necho.getResult();\n");
    parser.addCode("/*->#JH#*/}/*<-#JH#*/");
    return parser.getResult();
  };

  function Parser(delims) {
    this.lf1        = delims[0].charAt(0);
    this.lf2        = delims[0].charAt(1);
    this.rg1        = delims[1].charAt(0);
    this.rg2        = delims[1].charAt(1);
    this.end        = false;
    this.name       = START;
    this.vals       = {braces: 0, linefeeds: 0};
    this.buffer     = new umecob.Buffer();
    this.stack      = new umecob.Buffer();
    this.codeBuffer = new umecob.Buffer();
  }

  Parser.prototype.getResult = function(v) {
    return this.codeBuffer.join("");
  };

  Parser.prototype.addCode = function(v) {
    this.codeBuffer.add(v);
  };

  Parser.prototype.parse = function(c) {
    var next = this[this.name](c);
    if (next) this.name = next;
  };

  // start
  Parser.prototype[START] = function(c) {
    switch (c) {
    case "\n":
      this.vals.linefeeds++;
      return this.buffer.add(c);
    default:
      return this.buffer.add(c);
    case this.lf1:
      return JS_PRE_START;
    case "$":
      return PRE_SHORT_ECHO;
    case '\\':
      this.stack.push(START);
      return ESCAPING;
    case '\0':
      this.strToCode();
      this.end = true;
    }
  };

  // $
  Parser.prototype[PRE_SHORT_ECHO] = function(c) {
    if (c == '{') {
      this.strToCode();
      this.vals.braces = 1;
      return SHORT_ECHO;
    } else {
      this.buffer.add('$'+c);
      return START;
    }
  };

  // ${ }
  Parser.prototype[SHORT_ECHO] = function(c) {
    switch (c) {
    default:
      this.buffer.add(c);
      return SHORT_ECHO;
    case '{':
      this.buffer.add(c);
      this.vals.braces++;
      return SHORT_ECHO;
    case '?':
      if (this.vals.braces != 1) {
        this.buffer.add(c);
        return SHORT_ECHO;
      }
      else {
        return QS_SHORT_ECHO;
      }
    case '}':
      this.vals.braces--;
      if (this.vals.braces == 0) {
        this.codeBuffer.add('echo(' + ( this.buffer.join() ) + ');');
        this.buffer.clear();
        return START;
      } else {
        this.buffer.add(c);
        return SHORT_ECHO;
      }
    case "'":
      this.buffer.add(c);
      this.stack.push(this.name);
      return INSIDE_SQ;
    case '"':
      this.buffer.add(c);
      this.stack.push(this.name);
      return INSIDE_DQ;
    case '/':
      this.buffer.add(c);
      this.stack.push(this.name);
      return JS_PRE_COMMENT;
    case '\\':
      this.stack.push(this.name);
      return JS_ESCAPE;
    case '\0':
      throw new Error("unclosed tag : ${}");
      this.end = true;
    }
  };

  // ${hoge ? の状態
  Parser.prototype[QS_SHORT_ECHO] = function(c) {
    switch (c) {
    default:
      this.buffer.add('?');
      this.name = SHORT_ECHO;
      return Parser.prototype[SHORT_ECHO].call(this, c);
    case ':':
      this.mainval = this.buffer.join();
      this.buffer.clear();
      return ALTERNATE_SHORT_ECHO;
    case '}':
      this.codeBuffer.add('/*->#JH#*/try{echo(echo.tmp=' + ( this.buffer.join() ) + '||(function(){throw ""})());}catch(e){}/*<-#JH#*/');
      this.buffer.clear();
      return START;
    }
  };

  // ${hoge ?: の状態
  Parser.prototype[ALTERNATE_SHORT_ECHO] = function(c) {
    switch (c) {
    default:
      this.buffer.add(c);
      return ALTERNATE_SHORT_ECHO;
    case '{':
      this.buffer.add(c);
      this.vals.braces++;
      return ALTERNATE_SHORT_ECHO;
    case '}':
      this.vals.braces--;
      if (this.vals.braces == 0) {
        this.codeBuffer.add('/*->#JH#*/try{echo(echo.tmp='+(this.mainval)+'||(function(){throw ""})());}catch(e){try{echo('+ this.buffer.join() +');}catch(e){}}/*<-#JH#*/');
        this.buffer.clear();
        return START;
      } else {
        this.buffer.add(c);
        return ALTERNATE_SHORT_ECHO;
      }
    case "'":
      this.buffer.add(c);
      this.stack.push(this.name);
      return INSIDE_SQ;
    case '"':
      this.buffer.add(c);
      this.stack.push(this.name);
      return INSIDE_DQ;
    case '/':
      this.buffer.add(c);
      this.stack.push(this.name);
      return JS_PRE_COMMENT;
    case '\\':
      this.stack.push(this.name);
      return JS_ESCAPE;
    case '\0':
      throw new Error("unclosed tag : ${}");
      this.end = true;
    }
  };

  // this.lf1 が出た状態
  Parser.prototype[JS_PRE_START] = function(c) {
    switch (c) {
    case this.lf2:
      this.strToCode();
      return JS_WAITING_COMMAND;
    default:
      this.buffer.add(this.lf1);
      this[START](c);
      return START;
    }
  };

  // rg1 rg2 が出た状態(e.g. %])。次に改行コードが出てきたらJSのコードに含める
  Parser.prototype[FINISH_JS] = function(c) {
    switch (c) {
    case '\n':
      this.codeBuffer.add('\n');
      return START;
    default:
      this[START](c);
      return START;
    }
  };

  Parser.prototype.strToCode = function() {
    if (this.buffer.getIndex() > 0) {
      var LF = "";
      for (var i=0; i<this.vals.linefeeds;i++) 
        LF+="\n";
      this.codeBuffer.add('echo("' + this.buffer.join().replace(/\\g/, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')  + '");'+ LF);
      this.buffer.clear();
      this.vals.linefeeds = 0;
    }
  }

  // \ の次
  Parser.prototype[ESCAPING] = function(c) {
    switch (c) {
    case '\\':
    case this.lf1:
    case '$':
      this.buffer.add(c);
      return this.stack.pop();
    default:
      this.buffer.add('\\\\'+c);
      return this.stack.pop();
    }
  };

  // lf1 lf2 (e.g. [% )
  Parser.prototype[JS_WAITING_COMMAND] = function(c) {
    switch (c) {
    case ' ':
      return JS_WAITING_COMMAND;
    case '=':
      return JS_ECHO;
    case '{':
      this.buffer.add(c);
      return JS_INCLUDE;
    case '@':
      return JS_ASYNC;

    // the same as JS_START
    default:
      return Parser.prototype[JS_START].call(this, c);
    }
  };

  function jsStartTemplate(stateName, preEndStateName) {
    return function(c) {
      switch (c) {
      case this.rg1:
        return preEndStateName;
      case "'":
        this.buffer.add(c);
        this.stack.push(stateName);
        return INSIDE_SQ;
      case '"':
        this.buffer.add(c);
        this.stack.push(stateName);
        return INSIDE_DQ;
      case '/':
        this.buffer.add(c);
        this.stack.push(stateName);
        return JS_PRE_COMMENT;
      default:
        this.buffer.add(c);
        return stateName;
      case '\0':
      throw new Error("unclosed tag : " + this.lf1 + this.lf2 + this.rg1 + this.rg2);
        this.end = true;
      }
    };
  }

  function jsPreEndTemplate(mainStateName, fn) {
    return function(c) {
      switch (c) {
      case this.rg2:
        fn.apply(this);
        return FINISH_JS
      default:
        this.buffer.add(this.rg1 + c);
        return mainStateName;
      case '\0':
        return Parser.prototype[mainStateName].call(this, c);
      }
    };
  }


  // lf1 lf2 (e.g. [% )
  Parser.prototype[JS_START] = jsStartTemplate(JS_START, JS_PRE_END);
  Parser.prototype[JS_PRE_END] = jsPreEndTemplate(JS_START, function() {
    this.codeBuffer.add( this.buffer.join() );
    this.buffer.clear();
  });

  // lf1 lf2 = (e.g. [%= )
  Parser.prototype[JS_ECHO] = jsStartTemplate(JS_ECHO, JS_ECHO_PRE_END);
  Parser.prototype[JS_ECHO_PRE_END] = jsPreEndTemplate(JS_ECHO, function() {
    this.codeBuffer.add('echo(' + ( this.buffer.join() ) + ');');
    this.buffer.clear();
  });

  // lf1 lf2 { (e.g. [%{ )
  Parser.prototype[JS_INCLUDE] = jsStartTemplate(JS_INCLUDE, JS_INCLUDE_PRE_END);
  Parser.prototype[JS_INCLUDE_PRE_END] = jsPreEndTemplate(JS_INCLUDE, function() {
    this.codeBuffer.add('echo.addUmecob(echo.umecob.run(' + ( this.buffer.join() ) + '));');
    this.buffer.clear();
  });

  // lf1 lf2 @ (e.g. [%@ )
  Parser.prototype[JS_ASYNC] = jsStartTemplate(JS_ASYNC, JS_ASYNC_PRE_END);
  Parser.prototype[JS_ASYNC_PRE_END] = jsPreEndTemplate(JS_ASYNC, function() {
    this.codeBuffer.add('echo.addJunjo(function(){' + ( this.buffer.join() ) + '});');
    this.buffer.clear();
  });

  // / が出た場合. 正規表現とか割り算かもしれないけど
  Parser.prototype[JS_PRE_COMMENT] = function(c) {
    this.buffer.add(c);
    switch (c) {
    //case '/': return JS_SCOMMENT;
    case '*': return JS_MCOMMENT;
    default :  return this.stack.pop();
    }
  }
  /*
  // // が出た場合
  Parser.prototype["JS_SCOMMENT"] = function(c) {
    this.buffer.add(c);
    return (c == '\n') ? this.stack.pop() : 'JS_SCOMMENT'; 
  }
  */
  // /* が出た場合
  Parser.prototype[JS_MCOMMENT] = function(c) {
    this.buffer.add(c);
    switch (c) {
    case '*': return JS_PRE_ENDMCOMMENT;
    default : return JS_MCOMMENT;
    }
  }
  // /* *
  Parser.prototype[JS_PRE_ENDMCOMMENT] = function(c) {
    this.buffer.add(c);
    switch (c) {
    case '/': return this.stack.pop();
    default : return Parser.prototype[JS_MCOMMENT].call(this, c);
    }
  };
  // quotation
  function insideQuotation(stateName, type) {
    return function(c) {
      switch (c) {
      case type:
        this.buffer.add(c);
        return this.stack.pop();
      default:
        this.buffer.add(c);
        return stateName;
      case '\0':
        this.end = true;
        throw new Error("unclosed quotation : " + type);
      case '\n':
        return this.stack.pop();
      case '\\':
        this.stack.push(stateName);
        return JS_ESCAPE;
      }
    };
  }

  // ' の中の状態
  Parser.prototype[INSIDE_SQ] = insideQuotation(INSIDE_SQ, "'");
  // " の中の状態
  Parser.prototype[INSIDE_DQ] = insideQuotation(INSIDE_DQ, '"');
  // " の中でのescape
  Parser.prototype[JS_ESCAPE] = function(c) {
    this.buffer.add("\\"+c);
    return this.stack.pop();
  }

})();
          
umecob.compilers = {
  php  : umecob.defaultCompiler.bind(umecob, ['<?', '?>']),
  jsp  : umecob.defaultCompiler.bind(umecob, ['<%', '%>']),
  std  : umecob.defaultCompiler.bind(umecob, ['[%', '%]']),
  pass : function(delims, params) { return params.tpl }
};

showTime("umecobstart");

u = new umecob({sync : true});
var $j = u.run(__dirname + '/tpl.html', {
  hoge: "fad",
  afsd: "f"
});

if (typeof $j == 'function') {
  $j.next(function(err, out) {
    console.log(out);
        showTime("end");
  });
}
else {
        showTime("end");
  console.log($j);
}
