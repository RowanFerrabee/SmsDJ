
var lauriersNumber = '+12892301213';
var laurierResponse = 'Fuck off Laurier';
var twilioNumber = '+16479315875';

var spotifyClientId = '2cdbe13432e34307b41ab01bf6497491';
var spotifyClientSecret = 'c19745e36f4d4e63b6346d51b007ce5e';
var redirect_uri = '/callback'; 
var stateKey = 'spotify_auth_state';

var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var pg = require('pg');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var twilio = require('twilio')('AC80827003e02b768abd3a0eca9f3ed3f7', '41cac7e76eccfd261ed92263625f59e1');

var app = express();

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function (request, response) {
    response.writeHead('200',{'Context-Type': 'text/html'});
    fs.createReadStream('./login/login.html').pipe(response);
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

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});


app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'), '!');
});
