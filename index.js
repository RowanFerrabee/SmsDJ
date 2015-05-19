var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var pg = require('pg');

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(request, response) {
  response.writeHead("200",{"Context-Type": "text/html"});
  fs.createReadStream("./homepage/homepage.html").pipe(response);
});

app.get('/db', function (request, response) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * FROM directory', function(err, result) {
      done();
      if (err) { 
      	console.error(err); response.send("Error " + err);
      }
      else {
      	var table = "<h4>";
      	for(var i=0; i<result.rowCount; i++)
      		table += result.rows[i].name + ": " + result.rows[i].number + "</br>";
      	table+="</h4>";
       	response.send(table);
      }
    });
  });
});

app.post('/addUser', function(request, response) {
  var name = request.query.name;
  var number = request.query.number;

  console.log("Name: ",name,"  Number: ",number);
  var query = "insert into directory (name, number) values ('"+name+"','"+number+"')";

  console.log(query);

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
  	client.query(query, function(err, result) {
  			done();
  			if (err) {
  				console.error(err);
  			}
  		});
  });
  response.end();
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'), "!");
});
