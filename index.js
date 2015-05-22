
var lauriersNumber = "+12892301213";
var laurierResponse = "Fuck off Laurier";

var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var pg = require('pg');
var twilio = require('twilio')('AC80827003e02b768abd3a0eca9f3ed3f7', '41cac7e76eccfd261ed92263625f59e1');

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(request, response) {
  response.writeHead("200",{"Context-Type": "text/html"});
  fs.createReadStream("./homepage/homepage.html").pipe(response);
});

app.post('/text', function(request,response) {
  var from = request.body.From;
  var PartyID = request.body.Body;
  //var newUserGrp = from+",";
/*
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query("SELECT usergrp FROM Parties WHERE partyid = "+body, function(err, result) {
      done();
      if(err) {
        console.error(err); response.send("Error: " + err);
      }
      else {
        newUserGrp+=result.rows[0].usergrp;
      }
    });
  });*/
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    client.query("UPDATE Parties SET usergrp = '"+from+","+"'+usergrp WHERE partyid = "+PartyID, function (err, result) {
      done();
      if (err) { 
        console.error(err); response.send("Error: " + err);
      } else {
        twilio.sendMessage({
          to: from, // Any number Twilio can deliver to
          from: '+16479315875', // A number you bought from Twilio and can use for outbound communication
          body: 'Successfully added to party with ID: '+PartyID // body of the SMS message
        }, function(err, responseData) { //executed when a response is received from twilio
          if (!err) {
            // http://www.twilio.com/docs/api/rest/sending-sms#example-1
            console.log(responseData.from); // outputs "+14506667788"
            console.log(responseData.body); // outputs "word to your mother."
          } else {
            console.log(err);
          }
        });
      }
    });
  });
});

app.get("/newAdmin", function (request, response) {
  console.log("Touch me, Ariana");
  var name = request.query.name.replace(/[()';]/gi, '');
  var number = '+1'+request.query.number.replace(/[^0-9]/gi, '');
    var PartyID = Math.floor((Math.random()*100000)+1);
    pg.connect(process.env.DATABASE_URL, function (err, client, done) {
      client.query("INSERT INTO Parties VALUES ('"+name+"','"+number+"',"+PartyID+",'');",function (err, result) {
        done();
        if (err) { 
          console.error(err); response.send("Error: " + err);
        }
      });
    });
    response.status(PartyID).end();
});

app.get('/db', function (request, response) {
  response.writeHead("200",{"Context-Type": "text/html"});
  fs.createReadStream("./directory/directory.html").pipe(response);
});

app.get('/getData', function(request,response) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query("SELECT * FROM Parties", function(err, result) {
      done();
      if (err) { 
      	console.error(err); response.send("Error " + err);
      }
      else {
      	var table = "";
      	for(var i=0; i<result.rowCount; i++)
      		table += result.rows[i].spotifyname + ", " + result.rows[i].adminnumber+ ", " + result.rows[i].partyid+ ", " + result.rows[i].usergrp + "</br>";
       	response.send(table);
      }
    });
  });
});
/*
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
*/

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'), "!");
});
