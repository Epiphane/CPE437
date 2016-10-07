var Express = require('express');
var connections = require('../Connections.js');
var Tags = require('../Validator.js').Tags;
var ssnUtil = require('../Session.js');
var router = Express.Router({caseSensitive: true});
var passport = require('')

router.baseURL = '/Ssns';

router.get('/', function(req, res) {
   var body = [], ssn;

   if (req._validator.checkAdmin()) {
      for (cookie in ssnUtil.sessions) {
         ssn = ssnUtil.sessions[cookie];
         console.log("Session: " + cookie + ' -> ' + ssn);
         body.push({cookie: cookie, prsId: ssn.id, loginTime: ssn.loginTime});
      };
      res.status(200).json(body);
   }
});

router.get('/auth/facebook', passport.authenticate('facebook'));

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { successRedirect: '/',
                                      failureRedirect: '/login' }));

router.post('/', function(req, res) {
   var cookie;

   connections.getConnection(res, function(cnn) {
      cnn.query('select * from Person where email = ?', [req.body.email], function(err, result) {
         if (req._validator.check(result.length && result[0].password === req.body.password, Tags.badLogin)) {
            cookie = ssnUtil.makeSession(result[0], res);
            res.location(router.baseURL + '/'  + cookie).end();
         }
         cnn.release();
      });
   });
});

router.delete('/:cookie', function(req, res, next) {
   if (req._validator.check(req.params.cookie === req.cookies[ssnUtil.cookieName]
    || req.session.isAdmin(), Tags.noPermission)) {
       ssnUtil.deleteSession(req.params.cookie);
       res.sendStatus(200);
   }
});

router.get('/:cookie', function(req, res, next) {
   var cookie = req.params.cookie;
   var vld = req._validator;
   if (vld.checkPrsOK(ssnUtil.sessions[cookie].id)) {
      res.json({prsId: req.session.id});
   }
})

module.exports = router;
