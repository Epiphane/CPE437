var Express = require('express');
var connections = require('../Connections.js');
var Tags = require('../Validator.js').Tags;
var Time = require('../MockTime.js');
var router = Express.Router({caseSensitive: true});
router.baseURL = '/Enrs';

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

function releaseConn(conn) {
   return function() {
      conn.release();
   }
}

router.get('/:enrId', function(req, res) {
   var vld = req._validator;
   var admin = req.session && req.session.isAdmin();
   var enrolled = false;

   connections.getConnection(res, function(cnn) {
      cnn.query('Select * from Enrollment where enrId = ?', req.params.enrId,
      function(err, result) {
         if (vld.check(result.length, Tags.notFound)) {
            result = result[0];
            if(result.prsId === req.session.id)
               enrolled = true;
            if (vld.check(enrolled || admin, Tags.noPermission)) {
               res.json(result);
            }
            else {
               res.status(400).end();
            }
            cnn.release();
         }
         else
            cnn.release();
      });
   });
});

router.put('/:enrId', function(req, res) {
   var vld = req._validator;
   var admin = req.session && req.session.isAdmin();
   var enrolled = false;

   connections.getConnection(res, function(cnn) {
      cnn.query('Select * from Enrollment where enrId = ?', req.params.enrId,
      function(err, result) {
         if (vld.check(result.length, Tags.notFound)) {
            result = result[0];
            if(result.prsId === req.session.id)
               enrolled = true;

            if (vld.check(enrolled || admin, Tags.noPermission)) {
               cnn.query('Update Enrollment set ? where enrId = ?', [req.body, req.params.enrId],
               function(err, result) {
                  res.status(200).end();
                  cnn.release();
               });
            }
            else {
               cnn.release();
            }
         }
         else
            cnn.release();
      });
   });
});

router.delete('/:enrId', function(req, res) {
   var vld = req._validator;
   var prs = req.session;

   if (vld.checkAdminOrTeacher()) {
      connections.getConnection(res, function(cnn) {
         function doDelete() {
            cnn.query('DELETE FROM Enrollment WHERE enrId = ?', [req.params.enrId], function(err, result) {
               res.end();
               cnn.release();
            });
         }

         if (prs.isAdmin()) {
            doDelete();
         }
         else {
            cnn.query('SELECT * FROM Enrollment WHERE enrId = ?', [req.params.enrId], function(err, result) {
               if (vld.check(result && result[0].enrId === prs.id, Tags.noPermission)) {
                  doDelete();
               }
               else
                  cnn.release();
            });
         }
      });
   }
});

router.get('/:enrId/Itms', function(req, res) {
   var vld = req.validator;

   connections.getConnectionP()
      .then(function(conn) {
         return conn.query('SELECT * FROM Enrollment WHERE enrId = ?', [req.params.enrId])
            .then(function(enrollments) {
               var enrollment = enrollments[0];

               // Scope in Enrollment
               return vld.check(!!enrollment, Tags.notFound)
                  .then(function() {
                     return vld.checkPrsOK(enrollment.prsId);
                  })
                  .then(function() {
                     return conn.query('SELECT purch.purchaseid, purch.itemId, item.name, item.cost FROM StudentPurchase purch LEFT JOIN ShopItem item ON item.id = purch.itemId WHERE enrId = ?', [req.params.enrId]);
                  })
                  .then(sendResult(res))
            })
            .finally(releaseConn(conn));
      })
      .catch(handleError(res));
});

router.post('/:enrId/Itms', function(req, res) {
   var vld = req.validator;

   vld.hasFields(req.body, ["itemId"])
      .then(function() {
         return connections.getConnectionP();
      })
      .then(function(conn) {
         return conn.query('SELECT * FROM Enrollment WHERE enrId = ?', [req.params.enrId])
            .then(function(enrollments) {
               var enrollment = enrollments[0];

               // Scope in Enrollment
               return vld.check(!!enrollment, Tags.notFound)
                  .then(function() {
                     return vld.checkPrsOK(enrollment.prsId);
                  })
                  .then(function() {
                     return conn.query('SELECT * FROM ShopItem WHERE id = ?', [req.body.itemId]);
                  })
                  .then(function(items) {
                     var item = items[0];

                     // Scope in item
                     return vld.check(!!item, Tags.notFound)
                        .then(function() {
                           return vld.check(enrollment.creditsEarned >= item.cost, 'tooPoor');
                        })
                        .then(function() {
                           return conn.query('UPDATE Enrollment SET creditsEarned = creditsEarned - ? WHERE enrId = ?', [item.cost, enrollment.enrId]);
                        })
                        .then(function() {
                           return conn.query('INSERT INTO StudentPurchase (enrId, itemid) VALUES (?, ?)', [enrollment.enrId, item.id]);
                        })
                        .then(function(result) {
                           res.status(200).end();
                        });
                  });
            })
            .finally(releaseConn(conn));
      })
      .catch(handleError(res));
});

router.get('/:enrId/Atts', function(req, res) {
   var vld = req._validator;
   var challengeName = req.query.challengeName;
   var admin = req.session && req.session.isAdmin();

   query = 'SELECT * from Attempt att LEFT JOIN Challenge chl ON att.challengeName = chl.name LEFT JOIN Enrollment enr on enr.courseName = chl.courseName where enrId = ?';
   params = [req.params.enrId];
   if (challengeName) {
      query += ' and challengeName = ?';
      params.push(challengeName);
   }
   query += ' ORDER BY startTime ASC';

   connections.getConnection(res,
   function(cnn) {
      cnn.query(query, params,
      function(err, result) {
         res.json(result);
         cnn.release();
      });
   });

});

module.exports = router;
