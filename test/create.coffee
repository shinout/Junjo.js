require("./load.test").load global if global?

$J = Junjo.Template()
$J "first", -> 1
$J("second", -> 2 ).after "first"

$j = Junjo.create($J, noTimeout: true, destroy: true)

$j.on "end", (err, out) ->
  T.ok out.first is 1 and out.second is 2, "Junjo.create() worked"
$j.run()
