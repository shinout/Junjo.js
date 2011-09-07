/** example code to information object */
var ii = 1;
var CODE        = ii++,
    CODECOMMENT = ii++,
    TITLE       = ii++,
    OUTPUT      = ii++,
    DESCRIPTION = ii++;

var currentVals, data;

function exparser(file) {
  var lines = file.split('\n');

  currentVals = {};

  data = {
    codes : [],
    marks : {},
    comments : [],
    title    : {ja : '', en : ''},
    outputs  : [],
    description : {ja : {}, en : {}}
  };

  var state = CODE;
  lines.forEach(function(line) {
    state = exparser[state](line) || state;
  });

  return data;
}

exparser[CODE] = function(line) {
  if (line.match(/\/\*\*\ title/)) return TITLE;

  var m = line.match(/\/\*\* (.*)$/);
  if (m) {
    currentVals.commentType = m[1];
    currentVals.comment = {pos : data.codes.length};
    return CODECOMMENT;
  }
  var m2 = line.match(/\/\/\(([0-9,]+)\)/);
  if (m2) {
    m2[1].split(',').forEach(function(num) {
      data.marks[Number(num)] = data.codes.length;
    });
  }
  data.codes.push(line);
};

exparser[CODECOMMENT] = function(line) {
  if (line.match(/\*\*\//)) {
    data.comments.push(currentVals.comment);
    return CODE;
  }
  var m = line.match(/\* (ja|en) : (.*)$/);
  if (!m) return;
  var lang = m[1], comment = m[2];
  currentVals.comment[lang] = comment;
};

exparser[TITLE] = function(line) {
  if (line.match(/\/\*\*\ output/)) return OUTPUT;
  var m = line.match(/\* (ja|en) : (.*)$/);
  if (!m) return;
  var lang = m[1], title = m[2];
  data.title[lang] = title;
};

exparser[OUTPUT] = function(line) {
  if (line.match(/\*\*\//)) return;

  var m = line.match(/\/\*\*\ description\((ja|en)\)/);
  if (m) {
    currentVals.descLang = m[1];
    currentVals.descNum = 0;
    return DESCRIPTION;
  }

  if (line.length) data.outputs.push(line);
};

exparser[DESCRIPTION] = function(line) {
  if (line.match(/\*\*\//)) return;
  var m = line.match(/\/\*\*\ description\((ja|en)\)/);
  if (m) {
    currentVals.descLang = m[1];
    return;
  }
  var m2 = line.match('([0-9]+)\. (.*)$');
  if (m2) {
    currentVals.descNum = Number(m2[1]);
    data.description[currentVals.descLang][currentVals.descNum] = m2[2];
  }
  else if (line.length) {
    data.description[currentVals.descLang][currentVals.descNum] += line.trim();
  }
};

module.exports = exparser;

if (process.argv[1] == __filename) {
  test();
}

function test() {
  var file = require('fs').readFileSync(__dirname + '/../examples/02-async.js').toString();
  console.log(exparser(file));
}
