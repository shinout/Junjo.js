const colors = {
  'clear'  : '\033[0m',
  'black'  : '\033[30m',
  'red'    : '\033[31m',
  'green'  : '\033[32m',
  'yellow' : '\033[33m',
  'blue'   : '\033[34m',
  'purple' : '\033[35m',
  'cyan'   : '\033[36m',
  'white'  : '\033[37m'
};


function colorize(str, colorname) {
  return (colors[colorname] || colors['white']) + str + colors['clear']
};

module.exports = colorize;

module.exports.define = function() {
  if (!console.color) console.color = function() { console.log(colorize.apply(null, arguments)) }
  if (!console.ecolor) console.ecolor = function() { console.error(colorize.apply(null, arguments)) }
  Object.keys(colors).forEach(function(color) {
    if (!console[color])  console[color] = function(v) { console.color(v, color) }
    if (!console['e' + color])  console['e' + color] = function(v) { console.ecolor(v, color) }
    colorize[color] = function(v) { return colorize(v, color) };
  });
  return colorize;
};

module.exports.colors = Object.keys(colors);
