var express = require('express');
var fs = require('fs');
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  response.writeHead("200",{"Context-Type": "text/html"});
  fs.createReadStream("./index.html").pipe(response);
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'), "!");
});
