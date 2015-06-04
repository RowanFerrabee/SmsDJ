
var lauriersNumber = '+12892301213';
var laurierResponse = 'Fuck off Laurier';
var twilioNumber = '+16479315875';
var stateKey = 'spotify_auth_state';

var spotifyClientId = '2cdbe13432e34307b41ab01bf6497491';
var spotifyClientSecret = 'c19745e36f4d4e63b6346d51b007ce5e';
var redirect_uri = 'http://cryptic-cove-1713.herokuapp.com/callback';

var fs = require('fs');
var pg = require('pg');
var express = require('express');
var Promise = require('promise');
var bodyParser = require('body-parser');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var spotifyRequest = require('request');
var SpotifyWebApi =  require('spotify-web-api-node');
var twilio = require('twilio')('AC80827003e02b768abd3a0eca9f3ed3f7', 'bef62b8a2844a2c55711b2ca5ddcbe56');

var app = express();

var spotifyApi = new SpotifyWebApi({
    clientId : spotifyClientId,
    clientSecret : spotifyClientSecret,
    redirectUri : redirect_uri
});

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public')).use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function (request, response) {
    response.writeHead('200',{'Context-Type': 'text/html'});
    fs.createReadStream('./login/login.html').pipe(response);
});

app.post('/text', function (request,response) {
    var re = /[0-9]+/g;
    var from = request.body.From;
    var textBody = request.body.Body;
    var regexArray = re.exec(textBody);

    var sentNumber = false;
    if (regexArray) sentNumber = (textBody === regexArray[0]);

    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("SELECT PartyID FROM users WHERE UserNumber = '"+from+"'", function (dbErr, result) {
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
                        addToParty(from,textBody);
                    } else {
                        spotifyApi.searchTracks(textBody, { limit : 1, offset : 2 }).then(function (searchData) {
                           var trackURI = searchData.body.tracks.items[0].uri;
                           client.query("SELECT * FROM Party WHERE PartyID = '"+PartyID+"'", function (err, rslt) {
                                if (err) {
                                    console.error(err);
                                } else {
                                    var PlayListID, name;
                                    if (rslt.rowCount !== 0) {
                                        PlayListID = rslt.rows[0].playlistid;
                                        name = rslt.rows[0].spotifyid;
                                        spotifyApi.addTracksToPlaylist(name, PlayListID, [trackURI]).then(function (data) {
                                            console.log('Add song: ' + textBody);
                                            twilio.sendMessage({
                                                to: from,
                                                from: twilioNumber,
                                                body: "Successfully added song"
                                            }, function (twilioErr, responseData) {
                                                if (twilioErr) {
                                                   console.log(twilioErr);
                                                }
                                           });
                                        }, function (spotifyErr) {
                                            console.log('Failed to add to playlist!', spotifyErr);
                                            twilio.sendMessage({
                                                to: from,
                                                from: twilioNumber,
                                                body: "Failed to add any songs that match: "+textBody
                                            }, function (twilioErr, responseData) {
                                                if (twilioErr) {
                                                   console.log(twilioErr);
                                                }
                                           });
                                        });
                                    }
                                }
                            });
                        }, function (searchErr) {
                            console.log('Failed to search for track!', spotifyErr);
                            twilio.sendMessage({
                                to: from,
                                from: twilioNumber,
                                body: "Couldn't find any songs that match: "+textBody
                            }, function (twilioErr, responseData) {
                                if (twilioErr) {
                                   console.log(twilioErr);
                                }
                           });
                        });
                        
                    }
                } else {
                    if (sentNumber) {
                       addToParty(from,textBody);
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
    response.end();
});

/*-------------------------------START Spotify Party Administration-----------------------------------*/

app.get("/newAdmin", function (request, response) {
    var name = request.query.name.replace(/[()';]/gi, '');
    console.log("Received: "+name);
    var PartyID = Math.floor((Math.random()*100000)+1);
    spotifyApi.createPlaylist(name, 'SMS DJ', { 'public' : false }).then(function (data){
        var PlayListID = data.body.id;
        console.log(name+" added playlist with ID: "+PlayListID);
        pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
            client.query("INSERT INTO Party VALUES ("+PartyID+",'"+name+"','"+PlayListID+"');",function (dbErr, result) {
                done();
               if (dbErr) {
                    console.error(dbErr);                
                     response.send('Error: ' + dbErr);
                } else {
                    var Party = '{"partyid":'+PartyID+',"playlistid":"'+PlayListID+'","name":"'+name+'"}';
                    response.send(Party);  //TODO: Why does this work??
                }
            });
        });
    }, function (err) {
        console.log('Failed to add new admin!', err);
    });
});

app.post("/deleteParty", function (request, response) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("DELETE FROM Party WHERE PartyID = "+request.body.partyid,function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
            }
        });
        client.query("DELETE FROM users WHERE PartyID = '"+request.body.partyid+"'",function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
            }
        });
    });
});

/*--------------------------------END Spotify Party Administration------------------------------------*/


/*--------------------------------START Spotify Authorization Code------------------------------------*/

app.get('/login', function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    var scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-modify';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: spotifyClientId,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

app.get('/callback', function(req, res) {

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
                'Authorization': 'Basic ' + (new Buffer(spotifyClientId+ ':' + spotifyClientSecret).toString('base64'))
            },
            json: true
        };

        spotifyRequest.post(authOptions, function(error, response, body) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };

                // use the access token to access the Spotify Web API
                spotifyRequest.get(options, function(error, response, body) {
                    console.log(body);
                });

                spotifyApi.setAccessToken(access_token);
                spotifyApi.setRefreshToken(refresh_token);

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
        headers: { 'Authorization': 'Basic ' + (new Buffer(spotifyClientId + ':' + spotifyClientSecret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    spotifyRequest.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            res.send({
                'access_token': access_token
            });
        }
    });
});
/*---------------------------------END Spotify Authorization Code-------------------------------------*/


/*-----------------------START Extra Web Pages (Unrelated to app functionality)-----------------------*/

app.get('/about', function (request, response) {
    response.writeHead('200',{'Context-Type': 'text/html'});
    fs.createReadStream('./about/about.html').pipe(response);
});

app.get('/db', function (request, response) {
    response.writeHead('200',{'Context-Type': 'text/html'});
    fs.createReadStream('./directory/directory.html').pipe(response);
});

app.get('/getData', function (request,response) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("SELECT * FROM Party", function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
                response.send('Error: ' + dbErr);
            } else {
                if (result) {
                    var table = '<h1>Party:</h1>';
                    for(var i=0; i<result.rowCount; i++)
                        table += result.rows[i].partyid + ', ' + result.rows[i].spotifyid+ ', ' + result.rows[i].playlistid+'</br>';
                    client.query("SELECT * FROM users", function (err, rslt) {
                    done();
                    if (err) {
                        console.error(err);
                        response.send('Error: ' + err);
                    } else {
                        if (rslt) {
                            table += '<h1>Users:</h1>';
                            for(var i=0; i<rslt.rowCount; i++)
                                table += rslt.rows[i].partyid + ', ' + rslt.rows[i].usernumber+'</br>';
                            response.send(table);
                        }
                    }
                });
                }
            }
        });
    });
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'), '!');
});

/*----------------------------------END Extra Web Pages-------------------------------------*/



/*---------------------------------FUNCTION DEFINITIONS-------------------------------------*/

function addToParty(user, PartyID) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("SELECT PartyID FROM Party WHERE PartyID = "+PartyID, function (dbErr, result) {
            done();
            if (dbErr) {
                console.error(dbErr);
            } if (result.rowCount === 0) {
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
                client.query("INSERT INTO users values ("+PartyID+",'"+user+"')", function (err, rslt) {
                    done();
                    if (err) {
                        console.log(err);
                    } else {
                        twilio.sendMessage({
                            to: user,
                            from: twilioNumber,
                            body: 'Successfully added to party with ID: '+PartyID+""
                        }, function (twilioErr, responseData) {
                           if (twilioErr) {
                                console.log(twilioErr);
                            }
                        });
                        console.log('Added ',user,' to ',PartyID);
                    }
                });
            }
        });
    });
}

function removeFromParty(user,PartyID) {
    pg.connect(process.env.DATABASE_URL, function (pgErr, client, done) {
        client.query("DELETE FROM users WHERE UserNumber = '"+user+"'", function (dbErr, result) {
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

var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
