'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// Configuration

const FB_PAGE_TOKEN = 'EAAPZCc2rBmiMBAIjkSwcR0RKJQJ9Cxti654gAytRSZB5Unfh5fqHPFj8OMz4zgXsN2ipGwlGigG2SMaZCjSytIOjxvAw6IeIXXWdoZAZCrWEf2ZCsZA64ZAUeDL4r5ffbI9gdvm6ZBkZCLWh8nBO6dUEVL7pJ2TCLTLR0Qh0OoRKoApAZDZD'
const FB_PAGE_ID = '1162815120424133'
const FB_APP_SECRET ='0d2c5c281474bc2901cc543981fcca1b'
const WIT_TOKEN = 'I2H2JJZRLZYG6M7RM7Q6OL6HOA4XESXN'


// Webserver parameter
const PORT = process.env.PORT || 3000;

// Wit.ai parameters
//const WIT_TOKEN = WIT_TOKEN;

// Messenger API parameters
//const FB_PAGE_ID = FB_PAGE_ID;
if (!FB_PAGE_ID) { throw new Error('missing FB_PAGE_ID') }
//const FB_PAGE_TOKEN = FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
//const FB_APP_SECRET = FB_APP_SECRET;
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

  let FB_VERIFY_TOKEN = null;
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = "verify";
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

const sendCarouselMessage = (id, context) => {

  const university = context.university
  const urlString = 'http://www.houndly.co/'+university+'/events.json?page=1'
  request(urlString, function(error, response, resBody) {

    const elements = getElementsFromJson(resBody)

    const body = JSON.stringify({
      recipient: { id },
      message: {
        "attachment":{
          "type":"template",
          "payload":{
            "template_type":"generic",
            "elements": elements
          }
        }
      }
      ,
    });

    const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
    return fetch('https://graph.facebook.com/me/messages?' + qs, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body,
    })
    .then(rsp => rsp.json())
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      return json;
    });

  });
};

function getElementsFromJson(JSONbody) {
  
  var elements = [];
  var json = JSON.parse(JSONbody);
          //get evenrs array from json var events = json.events
          var events = json.events 
          var length = events.length;
          for (var i = 0; i < 10 ; i++){
            var eventJson = events[i]

            var element =             {
              "title":eventJson.title,
              "image_url":eventJson.image_link,
              "subtitle":eventJson.location,
              "buttons":[
              {
                "type":"web_url",
                "url":eventJson.source_url,
                "title":"View Website"
              },
              {
                "type":"postback",
                "title":"More info",
                "payload":"USER_DEFINED_PAYLOAD"
              }              
              ]
            }
            //create element from json

            elements.push(element);
          }
          return elements;
        }

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};



// first Entity Value

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
  Array.isArray(entities[entity]) &&
  entities[entity].length > 0 &&
  entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};


// Our bot actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending

      var context = sessions[sessionId].context;

      return sendCarouselMessage(recipientId, context)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
          );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
  fetch_events({sessionId, context, text, entities}) {
    return new Promise(function(resolve, reject) {
      var university = firstEntityValue(entities, 'university')
      if (university) {

        console.log(university)

        context.university = university;
        sessions[sessionId].context = context;
        return resolve(context);

      //   delete context.missingLocation;
      //   //context.forecast = 'sunny in ' + location ; // we should call a weather API here


      //   fetch('http://api.openweathermap.org/data/2.5/weather?q=' + location + '&APPID=628079360ba09956bd8afc86d62740d8')

      //       .then(function(res) {
      //         return res.json();
      //     }).then(function(json) {
      //         var description = (json['weather'][0]['description']);
      //         console.log(description);
      //         //return desrcription;
      //         return context.forecast = 'mainly ' + description + ' in ' + location
      //      });

      //    ;

      // delete context.missingLocation;
    } else {
      context.missingLocation = true;
      delete context.forecast;
    }
    return resolve(context);
  });
},

};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
} else {
  res.sendStatus(400);
}
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
              ).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
              .catch((err) => {
                console.error('Oops! Got an error from Wit: ', err.stack || err);
              })
            }
          } else {
            console.log('received event', JSON.stringify(event));
          }
        });
});
}
res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */

 function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
    .update(buf)
    .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');
