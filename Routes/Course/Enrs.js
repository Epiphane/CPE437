var Express = require('express');
var connections = require('../Connections.js');
var Tags = require('../Validator.js').Tags;
var Time = require('../MockTime.js');
var router = Express.Router({caseSensitive: true});
router.baseURL = '/Enrs';

function handleError(res) {
  return function(error) {
    var code = error.code || 400;
    delete error.code;

    res.status(code).json(error);
};
}

function sendResult(res, status) {
  return function(result) {
    res.status(status || 200).json(result);
};
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


router.get('/:enrId/Atts', function(req, res) {
   var vld = req._validator;
   var challengeName = req.query.challengeName;
   var admin = req.session && req.session.isAdmin();

   query = 'SELECT * from Attempt join Enrollment where prsId = ownerId && enrId = ?';
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
         if (vld.check(result.length, Tags.notFound) && vld.check(result[0].prsId === req.session.id || admin, Tags.noPermission)) {
            res.json(result);
         }
         cnn.release();
      });
   });

});

module.exports = router;
