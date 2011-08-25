var prevmem = 0;

function memdiff() {
  var cur = process.memoryUsage().heapUsed;
  console.log(cur - prevmem - 2576);
  prevmem = cur;
}

memdiff();
var fs = require('fs');
memdiff();
var Junjo = require('../Junjo');
memdiff();
var $j = new Junjo();
memdiff();
var a = 1;
memdiff();
var b = {};
memdiff();
var c = "s";
memdiff();
var d = function(){}
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
$j(function() {
});
memdiff();
