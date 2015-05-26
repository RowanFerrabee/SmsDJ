
var lauriersNumber = '+12892301213';
var laurierResponse = 'Fuck off Laurier';
var twilioNumber = '+16479315875';

var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var pg = require('pg');
var twilio = require('twilio')('AC80827003e02b768abd3a0eca9f3ed3f7', '41cac7e76eccfd261ed92263625f59e1');

var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function (request, response) {
    response.writeHead('200',{'Context-Type': 'text/html'});
    fs.createReadStream('./homepage/homepage.html').pipe(response);
});

app.post('/text', function (request,response) {
    var re = /[0-9]+/g;
    var from = request.body.From;
    var body = request.body.Body;
    var regexArray = re.exec(body);

    var sentNumber = false;
    if (regexArray) sentNumber = (body === regexArray[0]);

    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("SELECT partyid FROM Parties WHERE usergrp LIKE '%' || "+from+" || '%'", function (dbErr, result) {
            done();
            if(dbErr) {
                console.error(dbErr);
            }
            else {
                var PartyID = 0;
                if(result.rowCount !== 0) {
                    PartyID=result.rows[0].partyid;
                }
                if (PartyID !== 0) {
                    if (sentNumber) {
                        removeFromParty(from,PartyID);
                        addToParty(from,body);
                   } else {
                        //TODO: Add a song and reply on success
                        console.log('Add song: ' + body);
                    }
                } else {
                    if (sentNumber) {
                       addToParty(from,body);
                    } else {
                        twilio.sendMessage({
                            to: from,
                            from: twilioNumber,
                            body: 'Please connect to a party by replying with a valid PartyID'
                        }, function (twilioErr, responseData) {
                            if (twilioErr) {
                               console.log(twilioErr);
                            }
                        });
                    }
                }
            }
        });
    });
});

function addToParty(user, PartyID) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("UPDATE Parties SET usergrp = '"+user+","+"' || usergrp WHERE partyid = "+PartyID+" RETURNING partyid", function (dbErr, result) {
            done();
            console.log(result);
            if (dbErr) {
                console.error(dbErr);
            } else if (result.rowCount === 0) {    
                twilio.sendMessage({
                    to: user,
                    from: twilioNumber,
                    body: 'Failed to add you to party with ID: '+PartyID
                }, function(twilioErr, responseData) {
                    if (twilioErr) {
                        console.log(twilioErr);
                    }
                });
                console.log('Failed to add ',user,' to ',PartyID);
            } else {
                twilio.sendMessage({
                    to: user,
                    from: twilioNumber,
                    body: 'Successfully added to party with ID: '+PartyID
                }, function (twilioErr, responseData) {
                    if (twilioErr) {
                        console.log(twilioErr);
                    }
                });
                console.log('Added ',user,' to ',PartyID);
            }
        });
    });
}

function removeFromParty(user,PartyID) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("UPDATE Parties SET usergrp = REPLACE(usergrp,'"+user+",','') WHERE partyid = "+PartyID, function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
            } else {
                twilio.sendMessage({
                    to: user,
                    from: twilioNumber,
                    body: 'Successfully removed from party with ID: '+PartyID
                }, function (twilioErr, responseData) {
                    if (twilioErr) {
                        console.log(twilioErr);
                    }
                });
            }
        });
    });
}

app.get("/newAdmin", function (request, response) {
    var name = request.query.name.replace(/[()';]/gi, '');
    var number = '+1'+request.query.number.replace(/[^0-9]/gi, '');
    console.log("Received: "+name+", "+number);
    var PartyID = Math.floor((Math.random()*100000)+1); //TODO: Generate PartyIDs better.
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("INSERT INTO Parties VALUES ('"+name+"','"+number+"',"+PartyID+",'');",function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);                
                response.send('Error: ' + dbErr);
            } else {
                twilio.sendMessage({
                    to: number,
                    from: twilioNumber,
                    body: 'You are now the admin of party with ID: '+PartyID
                }, function (twilioErr, responseData) {
                    if (twilioErr) {
                        console.log(twilioErr);
                    }
                });
                response.send(''+PartyID);  //TODO: Why does this work??
            }
        });
    });
});

app.post("/deleteParty", function (request, response) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("DELETE FROM Parties WHERE spotifyname = '"+request.body.name+"';",function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
            } else {
                twilio.sendMessage({
                    to: request.body.number,
                    from: twilioNumber,
                    body: 'Your party is now closed'
                }, function (twilioErr, responseData) {
                    if (twilioErr) {
                        console.log(twilioErr);
                    }
                });
            }
        });
    });
});

app.get('/db', function (request, response) {
    response.writeHead('200',{'Context-Type': 'text/html'});
    fs.createReadStream('./directory/directory.html').pipe(response);
});

app.get('/getData', function (request,response) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("SELECT * FROM Parties", function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
                response.send('Error: ' + dbErr);
            } else {
                if (result) {
                    var table = '';
                    for(var i=0; i<result.rowCount; i++)
                        table += result.rows[i].spotifyname + ', ' + result.rows[i].adminnumber+ ', ' + result.rows[i].partyid+ ', ' + result.rows[i].usergrp + '</br>';
                    response.send(table);
                }
            }
        });
    });
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'), '!');
});
