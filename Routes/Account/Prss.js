var Express = require('express');
var connections = require('../Connections.js');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var PromiseUtil = require('../PromiseUtil.js');
var Time = require('../MockTime.js');

router.baseURL = '/Prss';

function handleError(res) {
  return function(error) {
    console.log(error);
    var code = error.code || 400;
    delete error.code

    res.status(code).json(error);
  }
}

function sendResult(res, status) {
  return function(result) {
    res.status(status || 200).json(result);
  }
}

router.get('/', function(req, res) {
   var specifier = req.query.email || !req.session.isAdmin() && req.session.email;

   connections.getConnection(res, function(cnn) {
      var handler = function(err, prsArr) {
         res.json(prsArr);
         cnn.release();
      }

      if (specifier)
         cnn.query('select id, email from Person where email = ?',
          [specifier], handler);
      else
         cnn.query('select id, email from Person', handler);
   });
});

router.post('/', function(req, res) {
   var vld = req._validator;  // Shorthands
   var body = req.body;
   var admin = req.session && req.session.isAdmin();

   if (admin && !body.password)
      body.password = "*";                       // Blocking password
   body.whenRegistered = Time();

   // This chain seems like it will always return the last test, not false if any fail
   // This can be seen by an attempt to post an admin with no AU
   if (vld.hasFields(body, ["email", "lastName", "role", "password"])
    && vld.chain(body.role == 0 || admin, Tags.noPermission)
    .check(body.role >= 0 && body.role < 3, Tags.badValue, ["role"])) {
      connections.getConnection(res,
      function(cnn) {
         cnn.query('SELECT * from Person where email = ?', body.email,
         function(err, result) {
            if (req._validator.check(!result.length, Tags.dupEmail)) {
               body.termsAccepted = Time();
               cnn.query('INSERT INTO Person SET ?', body,
               function(err, result) {
                  if (err)
                     res.status(500).json(err);
                  else
                     res.location(router.baseURL + '/' + result.insertId).end();
                  cnn.release();
               });
            } else
               cnn.release();
         });
      });
   }
});

router.get('/:id', function(req, res) {
   var vld = req._validator;

   if (vld.checkPrsOK(req.params.id)) {
      connections.getConnection(res,
      function(cnn) {
         cnn.query('select id, email, firstName, lastName, whenRegistered, role, termsAccepted from Person where id = ?', [req.params.id],
         function(err, prsArr) {
            if (vld.check(prsArr.length, Tags.notFound))
               res.json(prsArr);
            cnn.release();
         });
      });
   }
});

router.put('/:id', function(req, res) {
  var vld = req.validator;
  var body = req.body;
  var admin = req.session.isAdmin();

  // Validation
  return vld.checkPrsOK(req.params.id)
    .then(function() {
      return vld.check(!body.role || admin, Tags.noPermission);
    })
    .then(function() {
      return vld.check(body.password === undefined || body.oldPassword || admin, Tags.noOldPwd);
    })
    .then(function() {
      // Get connection
      return connections.getConnectionP();
    })
    .then(function(conn) {

      // Run queries
      return conn.query('SELECT * FROM Person WHERE id = ?', [req.params.id, body.oldPassword])
        .then(function(result) {
          return vld.check(body.password === undefined || result[0].password === body.oldPassword || admin, Tags.oldPwdMismatch);
        })
        .then(function() {

          // Update the person object
          delete body.oldPassword;
          return conn.query('Update Person SET ? WHERE id = ?', [body, req.params.id]);
        })
        .then(sendResult(res))
        .finally(function() {
          conn.release();
        });
    })
    .catch(handleError(res));
});

router.putid_OLD_WAY = function(req, res) {
   var vld = req._validator;
   var body = req.body;
   var admin = req.session && req.session.isAdmin();

   if (vld.checkPrsOK(req.params.id)
    && vld.check(body.role === undefined || admin, Tags.noPermission)
    && vld.check(body.password === undefined || body.oldPassword || admin, Tags.noOldPwd)) {
      connections.getConnection(res,
      function(cnn) {
         cnn.query('SELECT * FROM Person WHERE id = ?', [req.params.id, body.oldPassword],
         function(err, prsArr) {
            if (err) {
               res.status(500).end();
               cnn.release();
            }
            else if (vld.check(prsArr[0].password === body.oldPassword || admin, Tags.oldPwdMismatch)) {
               delete body.oldPassword;
               cnn.query('Update Person SET ? WHERE id = ?', [body, req.params.id],
               function(err, prsArr) {
                  if (err) {
                     res.status(500).end();
                  }
                  else if (vld.check(prsArr.affectedRows, Tags.notFound))
                     res.status(200).end();

                  cnn.release();
               });
            }
            else
               cnn.release();
         });
      });
   }
};

router.delete('/:id', function(req, res) {
   var vld = req._validator;

   if (vld.checkAdmin())
      connections.getConnection(res, function(cnn) {
         cnn.query('DELETE from Person where id = ?', [req.params.id],
         function (err, result) {
            if (vld.check(result.affectedRows, Tags.notFound))
               res.end();
            cnn.release();
         });
      });
});

router.get('/:id/Crss', function(req, res) {
   var query, qryParams;

   if (req._validator.checkPrsOK(req.params.id))
      query = 'SELECT * from Course where ownerId = ?';
      params = [req.params.id];

      connections.getConnection(res,
      function(cnn) {
         cnn.query(query, params,
         function(err, result) {
            res.json(result);

            cnn.release();
         });
      });
});

router.get('/:id/Atts', function(req, res) {
   var query, qryParams;

   if (req._validator.checkPrsOK(req.params.id))
      query = 'SELECT * from Attempt where ownerId = ? ORDER BY startTime ASC';
      params = [req.params.id];
      if (req.query.challengeName) {
         query += ' and challengeName = ?';
         params.push(req.query.challengeName);
      }

      connections.getConnection(res,
      function(cnn) {
         cnn.query(query, params,
         function(err, result) {
            res.json(result);

            cnn.release();
         });
      });
});

router.post('/:id/Atts', function(req, res) {
   var vld = req.validator;
   var owner = req.params.id;

   return vld.checkPrsOK(owner)
   .then(function() {
     return vld.hasFields(req.body, ['input']);
   })
   .then(function() {
     return connections.getConnectionP();
   })
   .then(function(conn) {
      var chlName = req.body.challengeName;

      // Verify specified challenge exists
      return conn.query('SELECT * FROM Challenge WHERE name = ?', [chlName])
         .then(function(result) {
            var chl = result && result.length && result[0];
            return vld.check(result.length, Tags.badChlName)

               // Verify # of attempts is still under limit
               .then(function() {
                  return conn.query('SELECT * FROM Attempt WHERE ' +
                                    'ownerId = ? AND challengeName = ?',
                                    [owner, chlName]);
               })
               .then(function(result) {
                  return vld.check(result.length < chl.attsAllowed, Tags.excessAtts);
               })
               .then(function() {
                  req.body.ownerId = owner;
                  req.body.startTime = Time();

                  // Score the attempt
                  var input = req.body.input.toLowerCase();
                  var answer = chl.answer.toLowerCase();

                  req.body.score = 0;
                  if (chl.type === 'number') {
                     input = parseInt(input);
                     answer = parseInt(answer);
                     if (!Number.isNaN(input)) {
                        req.body.score ++;

                        if (Math.abs(input - answer) < 0.01) {
                           req.body.score ++;
                        }
                     }
                  }
                  else if (chl.type === 'term') {
                     answer = JSON.parse(answer);
                     var exact =  answer.exact;
                     var inexact = answer.inexact;

                     if (exact.indexOf(input) >= 0) {
                        req.body.score = 2;
                     }
                     else if (inexact.indexOf(input) >= 0) {
                        req.body.score = 1;
                     }
                  }

                  return conn.query('INSERT INTO Attempt SET ?', req.body);
               })
               .then(function(result) {
                  res.location(router.baseURL + '/' + owner + '/Atts/'
                     + result.insertId).end();
               })
               .catch(handleError(res))
               .finally(function() {
                  conn.release();
               });
         });
   })
   .catch(handleError(res));
});

module.exports = router;
