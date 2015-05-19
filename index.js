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
  fs.createReadStream("./homepage/index.html").pipe(response);
});

app.get('/db', function (request, response) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * FROM test_table', function(err, result) {
      done();
      if (err)
       { console.error(err); response.send("Error " + err); }
      else
       { response.send(result.rows); }
    });
  });
});

app.post('/addUser', function(request, response) {
  var name = request.body.name;
  var number = request.body.number;

  console.log("Name: ",name,"  Number: ",number);
  var query = 'insert into directory (name, number) values ('+name+','+number+')';

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
  	client.query(query, function(err, result) {
  			done();
  			if (err) {
  				console.error(err);
  			}
  		});
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'), "!");
});
