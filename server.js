var connect = require('connect'),
	colors = require('colors');

connect.createServer(
    connect.static(__dirname)
).listen(8080);

console.log("\n================".grey);
console.log("\"Jamie Doesn't Want to Take a Bath\"".cyan);
console.log("================".grey);
console.log("a play by ".green, "Bethany Corey".green.bold);
console.log("music and player by ".green, "Paul Marbach\n".green.bold);
console.log("to view, go to ".green, "http://localhost:8080".yellow.bold.underline);

if(process.argv.length > 2 && process.argv[2] === "open") {
    var openn = require('open');
    openn('http://localhost:8080');
}