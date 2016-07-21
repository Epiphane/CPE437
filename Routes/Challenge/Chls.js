var Express = require('express');
var connections = require('../Connections.js');
var Tags = require('../Validator.js').Tags;
var Time = require('../MockTime.js');
var router = Express.Router({caseSensitive: true});
router.baseURL = '/Chls';

function handleError(res) {
   return function(error) {
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

function releaseConn(conn) {
   return function() {
      conn.release();
   }
}

// Get only OPEN challenges
router.get('/', function(req, res) {
   req.validator.check(!!req.query.prsId || !!req.query.enrId, 'no prsId or enrId')
      .then(function() {
         return connections.getConnectionP();
      })
      .then(function(conn) {
         var query = [
            'SELECT name, description, attsAllowed, openTime, prsId from Challenge chl',
            'LEFT JOIN Enrollment enr ON enr.courseName = chl.courseName',
            'WHERE openTime <= ?'
         ];
         var params = [Time()];

         if (req.query.enrId) {
            query.push('AND enrId = ?');
            params.push(req.query.enrId);
         }
         else {
            query.push('AND prsId = ?');
            params.push(req.query.prsId);
         }

         console.log(query.join(' '), params);

         conn.query(query.join(' '), params)
            .then(sendResult(res))
            .finally(releaseConn(conn));
      })
      .catch(handleError(res));
});

router.post('/', function(req, res) {
   if (req._validator.checkAdminOrTeacher() && req._validator.hasFields(req.body, ["name", "courseName", "type", "answer", "openTime"])) {
      req.body.openTime = new Date(req.body.openTime);
      connections.getConnection(res, function(cnn) {
         cnn.query('SELECT * from Challenge where name = ? AND courseName = ?', [req.body.name, req.body.courseName],
         function(err, result) {
            if (err) {
               console.log(err);
               res.status(500).end();
               cnn.release();
            }
            else if (req._validator.check(!result.length, Tags.dupName)) {
               cnn.query('INSERT INTO Challenge SET ?', req.body, function(err, result) {
                  console.log(err, result);
                  res.location(router.baseURL + '/' + req.body.name).send(200).end();
                  cnn.release();
               });
            }
            else
               cnn.release();
         });
      });
   }
});

router.get('/:name', function(req, res) {
   connections.getConnection(res, function(cnn) {
      cnn.query('SELECT name, description, attsAllowed, openTime, courseName from Challenge where name = ?', req.params.name, function(err, result) {
         if (result.length === 1) {
            res.json(result[0]);
         }
         else {
            res.status(404).send();
         }
         cnn.release();
      });
   });
});

router.get('/:name/Atts', function(req, res) {
   connections.getConnection(res, function(cnn) {
      function getResult() {
         var query = 'SELECT id, ? as challengeURI, ownerId, duration, score, startTime, state from Attempt where challengeName = ? ORDER BY startTime DESC';
         var params = ['Chls/' + req.params.name, req.params.name];

         if (req.query.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(req.query.limit));
         }

         cnn.query(query, params, function(err, result) {
            res.json(result);
            cnn.release();
         });
      }

      if (req.session.isAdmin()) {
         getResult();
      }
      else {
         cnn.query('SELECT * FROM Attempt WHERE challengeName = ? AND ownerId = ?', [req.params.name, req.session.id], function(err, result) {
            if (req._validator.check(result.length, Tags.noPermission)) {
               getResult();
            }
            else {
               cnn.release();
            }
         });
      }
   });
});

module.exports = router;
