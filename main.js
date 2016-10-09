var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');

var passport = require('./Database/passport');

var bodyParser = require('body-parser');
var Session = require('./Routes/Session.js');
var Validator = require('./Routes/Validator.js');
var _Validator = require('./Routes/_Validator.js');
var connections = require('./Routes/Connections.js');
var Time = require('./Routes/MockTime.js');

var async = require('async');

var app = express();

// Static paths to be served like index.html and all client side js
app.use(express.static(path.join(__dirname, 'public')));

// Parse all request bodies using JSON
app.use(bodyParser.json());

// Attach cookies to req as req.cookies.<cookieName>
app.use(cookieParser());

// Set up Session on req if available
app.use(Session.router);

app.get('/Time', function(req, res) {
   res.json({
      time: Time(),
      offset: Time.offset
   });
});

app.use(function(req, res, next) {
   req.validator = new Validator(req, res);
   req._validator = new _Validator(req, res);

   console.log(req.method, req.path);

   // if (req.session || (req.method === 'POST' &&
   //  (req.path === '/Prss' || req.path === '/Ssns')))
      next();
   // else
   //    res.status(401).json([{tag: Validator.Tags.noLogin}]);

});

app.use('/Prss', require('./Routes/Account/Prss'));
// app.use('/Ssns', require('./Routes/Account/Ssns'));
require('./Routes/Account/Ssns')(app, passport);
app.use('/Chls', require('./Routes/Challenge/Chls'));
app.use('/Atts', require('./Routes/Challenge/Atts'));
app.use('/Crss', require('./Routes/Course/Crss'));
app.use('/Enrs', require('./Routes/Course/Enrs'));

app.put('/Time', function(req, res) {
   req.validator.checkAdmin()
      .then(function() {
         return req.validator.hasFields(req.body, ['time']);
      })
      .then(function() {
         Time.offset = (new Date(req.body.time)).getTime() - (new Date()).getTime();
         res.status(200).end();
      })
      .catch(function(err) {
         console.log(error);
         var code = error.code || 400;
         delete error.code

         res.status(code).json(error);
      })
});

app.delete('/DB', function(req, res) {

   connections.getConnection(res, function(cnn) {
      async.series([
         function(callback){
            cnn.query('delete from Attempt', callback);
         },
         function(callback){
            cnn.query('delete from Challenge', callback);
         },
         function(callback){
            cnn.query('delete from Person', callback);
         },
         function(callback){
            cnn.query('delete from Course', callback);
         },
         function(callback){
            cnn.query('delete from Enrollment', callback);
         },
         function(callback){
            cnn.query('delete from StudentPurchase', callback);
         },
         function(callback){
            cnn.query('delete from ShopItem', callback);
         },
         function(callback){
            cnn.query('alter table Attempt auto_increment = 1', callback);
         },
         function(callback){
            cnn.query('alter table Person auto_increment = 1', callback);
         },
         function(callback){
            cnn.query('alter table Enrollment auto_increment = 1', callback);
         },
         function(callback){
            cnn.query('alter table ShopItem auto_increment = 1', callback);
         },
         function(callback){
            cnn.query('alter table StudentPurchase auto_increment = 1', callback);
         },
         function(callback){
            cnn.query('INSERT INTO Person (id, firstName, lastName, email,' +
                ' password, whenRegistered, termsAccepted, role) VALUES (' +
                '1, "Admin", "IAM", "Admin@11.com","password", NOW(), NOW(), 2);'
            , callback);
         },
         function(callback){
            for (var session in Session.sessions)
               delete Session.sessions[session];
            res.send();
         }
      ],
      function(err, status) {
         console.log(err);

         res.end(500);
      }
   );
   cnn.release();
   });
});

app.use(function(err, req, res, next) {
   console.error(err.stack);
   res.status(500).send('error', {error: err});
});

app.listen(process.env.OPENSHIFT_NODEJS_PORT || process.env.NODE_PORT || 3000,
           process.env.OPENSHIFT_NODEJS_IP   || process.env.NODE_IP   || 'localhost',
function () {
   console.log('App Listening on port 3000');
});
