Junjo   = require "junjo"
$j      = Junjo.create()
fs      = require "fs"
exec    = require('child_process').exec
cl      = require('termcolor').define
ignores = ['load.test.js', 'all.coffee', 'memuse.js']

#1. get test files
$j('files', -> fs.readdir __dirname, @cb)
.eshift()
.post (files)->
  # filter unnecessary files
  files.filter (v)->
    v.slice(-3) is '.js' or v.slice(-7) is ".coffee" and ignores.indexOf(v) < 0

$j('exec', (files)->
  files.forEach (file, k)=>
    if file.slice(-3) is ".js"
      exec "node #{__dirname}/#{file}", @callbacks file
    else
      exec "coffee #{__dirname}/#{file}", @callbacks file
)
.after()
.reduce((result, args, filename)->
  err    = args[0]
  stdout = args[1]
  stderr = args[2]
  console.log "------------------------------------[ #{filename} ]------------------------------------"
  console.ered err if err
  console.log stdout
  console.yellow stderr
  result.push filename if err or stderr
  return result
, [])
.timeout(0)
.out(0)

$j.on "end", (err, out)->
  console.log if out.length then "ERROR IN #{out.join " and "}" else "SUCCEEDED"

$j.run()
