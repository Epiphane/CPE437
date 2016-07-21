var Express = require('express');
var connections = require('../Connections.js');
var Tags = require('../Validator.js').Tags;
var Time = require('../MockTime.js');
var router = Express.Router({caseSensitive: true});
router.baseURL = '/Crss';

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


router.post('/', function(req, res) {
   if (req._validator.checkAdminOrTeacher() && req._validator.hasFields(req.body, ["name"])) {
      connections.getConnection(res, function(cnn) {
         cnn.query('SELECT * from Course where name = ?', req.body.name,
         function(err, result) {
            if (err) {
               console.log(err);
               res.status(500).end();
               cnn.release();
            }
            else if (req._validator.check(!result.length, Tags.dupName)) {
               req.body.ownerId = req.session.id;
               cnn.query('INSERT INTO Course SET ?', req.body, function(err, result) {
                  res.location(router.baseURL + '/' + req.body.name).status(200).end();
                  cnn.release();
               });
            }
            else
               cnn.release();
         });
      });
   }
});

router.put('/:name', function(req, res) {
   connections.getConnection(res, function(cnn) {
      if (req._validator.checkAdminOrTeacher()) {
         cnn.query('SELECT * from Course where name = ?', [req.params.name], function(err, result) {
            var ok = req._validator.check(result.length === 1, Tags.notFound);

            if (ok && req.session.isTeacher()) {
               ok = req._validator.check(req.body.ownerId == undefined || req.body.ownerId === result[0].ownerId, Tags.noPermission)
                 && req._validator.check(result[0].ownerId === req.session.id, Tags.noPermission);
            }

            if (ok) {
               cnn.query('SELECT * from Course where name = ?', [req.body.name], function(err, result) {
                  if (req._validator.check(result.length === 0 || req.body.name == undefined, Tags.dupName) &&
                      req._validator.check(req.session.isAdmin() || result)) {
                     cnn.query('UPDATE Course SET ? WHERE name = ?', [req.body, req.params.name], function(err, result) {
                        if (err) {
                           res.status(500).end();
                        }
                        else if (req._validator.check(result.affectedRows, Tags.notFound))
                           res.status(200).end();

                        cnn.release();
                     });
                  }
                  else {
                     cnn.release();
                  }
               });
            }
            else {
               cnn.release();
            }
         });
      }
   });
});

router.delete('/:name', function(req, res) {
   if (req._validator.checkAdminOrTeacher()) {
      connections.getConnection(res, function(cnn) {
         cnn.query('SELECT * from Course where name = ?', [req.params.name], function(err, result) {
            if (req._validator.check(result.length === 1, Tags.notFound) &&
                req._validator.check(req.session.isAdmin() || req.session.id === result[0].ownerId, Tags.noPermission)) {

               cnn.query('DELETE from Course where name = ?', [req.params.name], function(err, result) {
                  if (err) {
                     res.status(500).end();
                  }
                  else if (req._validator.check(result.affectedRows, Tags.notFound))
                     res.status(200).end();

                  cnn.release();
               });
            }
            else {
               cnn.release();
            }
         });
      });
   }
});

router.post('/:name/Enrs', function(req, res) {
   var vld = req._validator;
   var prs = req.session;

   connections.getConnection(res, function(cnn) {
      function doEnroll() {
         cnn.query('INSERT INTO Enrollment (prsId, courseName, whenEnrolled) VALUES (?, ?, ?)',
            [req.body.prsId, req.params.name, Time()()], function(err, result) {
            if (err) {
               if (vld.check(err.code !== 'ER_DUP_ENTRY', Tags.dupName)) {
                  console.log(err);
                  res.status(400).end();
               }
            }
            else {
               res.location(router.baseURL + '/' + req.params.name + '/Enrs/'
                + result.insertId).end();
            }

            cnn.release();
         });
      }

      if (vld.hasFields(req.body, ['prsId'])) {
         if (prs.isAdmin() || prs.id === req.body.prsId) {
            doEnroll();
         }
         else if (vld.check(prs.isTeacher(), Tags.noPermission)) {
            cnn.query('SELECT ownerId FROM Course WHERE name = ?', [req.params.name], function(err, result) {
               if (vld.check(result && result[0].ownerId === prs.id, Tags.noPermission)) {
                  doEnroll();
               }
               else
                  cnn.release();
            });
         }
         else
            cnn.release();
      }
      else
         cnn.release();
   });
});

router.get('/:name/Enrs', function(req, res) {
   var vld = req._validator;
   var prs = req.session;

   if (vld.checkAdminOrTeacher()) {
      connections.getConnection(res, function(cnn) {
         function getResult() {
            var queryArr = [
               'SELECT enrId, whenEnrolled, prsId',
               'FROM Enrollment enr',
               'WHERE enr.courseName = ?'
            ];
            if (req.query.full) {
               queryArr[0] += ', lastName, firstName, email';
               queryArr[1] += ' INNER JOIN Person p ON p.id = prsId'
            }
            cnn.query(queryArr.join(' '), [req.params.name], function(err, result) {
               res.json(result);
               cnn.release();
            });
         }

         if (prs.isAdmin()) {
            getResult();
         }
         else {
            cnn.query('SELECT ownerId FROM Course WHERE name = ?', [req.params.name], function(err, result) {
               if (vld.check(result && result[0].ownerId === prs.id, Tags.noPermission)) {
                  getResult();
               }
               else
                  cnn.release();
            });
         }
      });
   }
});

router.get('/:name/Enrs/:enrId', function(req, res) {
   var vld = req._validator;
   var prs = req.session;

   connections.getConnection(res, function(cnn) {
      function getResult(needsIdCheck) {
         var queryArr = [
            'SELECT enrId, whenEnrolled, prsId, lastName, firstName',
            'FROM Enrollment enr INNER JOIN Person p ON p.id = prsId',
            'WHERE enr.enrId = ? AND enr.courseName = ?'
         ];
         cnn.query(queryArr.join(' '), [req.params.enrId, req.params.name], function(err, result) {
            if (vld.check(result && result.length, Tags.notFound) &&
               (!needsIdCheck || vld.check(result[0].prsId === prs.id, Tags.noPermission)))
               res.json(result[0]);

            cnn.release();
         });
      }

      if (prs.isAdmin()) {
         getResult(false);
      }
      else if (prs.isTeacher()) {
         cnn.query('SELECT ownerId FROM Course WHERE name = ?', [req.params.name], function(err, result) {
            if (result && result[0].ownerId === prs.id) {
               getResult(false);
            }
            else
               getResult(true);
         });
      }
      else
         getResult(true);
   });
});

router.put('/:name/Enrs/:enrId', function(req, res) {
   var vld = req._validator;
   var admin = req.session && req.session.isAdmin();
   var owner = false;
   var enrolled = false;

   connections.getConnection(res, function(cnn) {
      cnn.query('Select * from Course where name = ?', req.params.name,
      function(err, result) {
         if (vld.check(result.length, Tags.notFound)) {
            result = result[0];
            if (result.ownerId === req.session.id)
               owner = true;

            cnn.query('Select * from Enrollment where enrId = ?', req.params.enrId,
            function(err, result) {
               if (vld.check(result.length, Tags.notFound)) {
                  result = result[0];
                  if(result.prsId === req.session.id)
                     enrolled = true;

                  if (vld.check(owner || enrolled || admin, Tags.noPermission)) {
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
         }
         else
            cnn.release();
      });
   });
});

router.delete('/:name/Enrs/:enrId', function(req, res) {
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
            cnn.query('SELECT ownerId FROM Course WHERE name = ?', [req.params.name], function(err, result) {
               if (vld.check(result && result[0].ownerId === prs.id, Tags.noPermission)) {
                  doDelete();
               }
               else
                  cnn.release();
            });
         }
      });
   }
});

router.get('/:name/Chls', function(req, res) {
   var vld = req.validator;
   var prs = req.session;

   vld.checkAdminOrTeacher()
      .then(function() {
         return connections.getConnectionP();
      })
      .then(function(conn) {

         return conn.query('SELECT name, description, attsAllowed, openTime from Challenge WHERE courseName = ?', [req.params.name])
            .then(sendResult(res))
            .finally(function() {
               conn.release();
            });
      })
      .catch(handleError(res));

});

router.get('/:crsName/Itms', function(req, res) {
   var vld = req.validator;
   var admin = req.session && req.session.isAdmin();
   var enrolled = false;
   var owner = false;

   connections.getConnection(res, function(cnn) {
      cnn.query('Select * from Enrollment where courseName = ?', req.params.crsName,
      function(err, result) {
            if (result.length) {
               for (var i = 0; i < result.length; i++) {
                  if (result[i].prsId === req.session.id)
                     enrolled = true;
               }
            }
            cnn.query('Select * from Course where name = ?', req.params.crsName,
            function(err, result) {
               if (result.length) {
                  for (var i = 0; i < result.length; i++) {
                     if (result[i].ownerId == req.session.id)
                        owner = true;
                  }
               }
               if (vld.check(enrolled || owner || admin, Tags.noPermission)) {
                  cnn.query('Select name, cost, purchased from ShopItem where courseName = ?', req.params.crsName,
                  function(err, result) {
                     res.json(result);
                     cnn.release();
                  });
               }
               else {
                  cnn.release();
               }
            });
      });
   });
});

router.post('/:crsName/Itms', function(req, res) {
   var vld = req._validator;

   if (vld.hasFields(req.body, ["name", "cost"])) {
      connections.getConnection(res, function(cnn) {
         cnn.query('Select name from ShopItem where name = ?', req.body.name,
         function(result) {
            if (vld.check(!result.length, Tags.dupName)) {
               cnn.query('Insert into ShopItem (name, courseName, cost) value (?, ?, ?)',
               [req.body.name, req.params.crsName, req.body.cost],
               function(err, result) {
                  if (err)
                     res.status(400).json(err);
                  else {
                     res.location(router.baseURL + '/' + req.params.crsName + '/Itms/' + result.insertId).status(200).end();
                  }
               });
            }
            else {
               cnn.release();
            }
         });
      });
   }
});

router.put('/:crsName/Itms/:itmId', function(req, res) {
   var vld = req._validator;
   var admin = req.session && req.session.isAdmin();
   var owner = false;
   var purchase = false;
   var name = req.body.name;
   var cost = req.body.cost;
   var purchased = req.body.purchased;
   var error = false;

   connections.getConnection(res, function(cnn) {
      cnn.query('Select * from Course where name = ?', req.params.crsName,
      function(err, result) {
         if (vld.check(result && result.length, Tags.notFound)) {
            result = result[0];
            if (result.ownerId === req.session.id)
               owner = true;

            cnn.query('Select * from ShopItem where id = ?', req.params.itmId,
            function(err, result) {
               if (vld.check(result && result.length, Tags.notFound)) {
                  purchase = result[0].purchased;

                  if (name && !vld.check(admin || owner, Tags.noPermission))
                     error = true;
                  if (cost && !vld.check(admin || owner, Tags.noPermission))
                     error = true;

                  if ((purchased !== undefined) && purchased && !vld.check(!purchase || admin || owner, Tags.noPermission))
                     error = true;

                  if (!error) {
                     cnn.query('Update ShopItem set ? where id = ?', [req.body, req.params.itmId],
                     function(err) {
                        if(err)
                           res.status(400).json(err);
                        else {
                           res.end();
                        }
                        cnn.release();
                     });
                  }
               }
               else {
                  cnn.release();
               }
            });
         }
         else {
            cnn.release();
         }
      });
   });
});

router.delete('/:crsName/Itms/:itmId', function(req, res) {
   var vld = req.validator;
   var admin = req.session && req.session.isAdmin();

   if (vld.check(admin, Tags.noPermission)) {
      connections.getConnection(res, function(cnn) {
         cnn.query('Delete from ShopItem where id = ?', req.params.itmId,
         function(err, result) {
            res.end();
            cnn.release();
         });
      });
   }
});

module.exports = router;
