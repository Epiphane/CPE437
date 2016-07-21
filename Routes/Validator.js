var Promise = require('bluebird');

// Create a validator that draws its session from |req|, and reports
// errors on |res|
var Validator = function(req, res) {
   this.errors = [];   // Array of error objects having tag and params
   this.session = req.session;
   this.res = res
}

// List of errors, and their corresponding resource string tags
Validator.Tags = {
   noLogin: "noLogin",              // No active session/login
   noPermission: "noPermission",    // Login lacks permission.
   missingField: "missingField",    // Field missing from request. Params[0] is field name
   badValue: "badValue",            // Field has bad value.  Params[0] gives field name
   notFound: "notFound",            // Entity not present in DB
   badLogin: "badLogin",            // Email/password combination invalid
   dupEmail: "dupEmail",            // Email duplicates an existing email
   noTerms: "noTerms",              // Acceptance of terms is required.
   noOldPwd: "noOldPwd",            // Change of password requires an old password
   dupName: "dupName",              // Name duplicates an existing Challenge Name
   incompAttempt: "incompAttempt",  // Standing Attempt
   badChlName: "badChlName",        // Bad Challenge Name
   attNotClosable: "attNotClosable",// Attempt not in a closable state
   attClosed: "attClosed",          // Attempt is alread closed
   excessAtts: "excessAtts",        // Too many attempts for this challenge.
   oldPwdMismatch: "oldPwdMismatch"// Incorrect old password.
}

Validator.prototype.ok = function() {return !this.errors.length;}

// Check test.  If false, add an error with tag and possibly empty array
// of qualifying parameters, e.g. name of missing field if tag is
// Tags.missingField.  Close the response.
Validator.prototype.check = function(test, tag, params, passThrough) {
   if (!test) {
      return Promise.reject({tag: tag, params: params});
   }

   return Promise.resolve(passThrough);
}

Validator.prototype.checkAdmin = function(passThrough) {
   return this.check(this.session && this.session.isAdmin(),
      Validator.Tags.noPermission, {}, passThrough);
}

Validator.prototype.checkAdminOrTeacher = function(passThrough) {
   return this.check(this.session && (this.session.isAdmin() || this.session.isTeacher()),
      Validator.Tags.noPermission, {}, passThrough);
}

// Validate that AU is the specified person or is an admin
Validator.prototype.checkPrsOK = function(prsId) {
   return this.check(this.session && (this.session.isAdmin() || this.session.id == prsId),
      Validator.Tags.noPermission);
}

// Check presence of truthy property in |obj| for all fields in fieldList
Validator.prototype.hasFields = function(obj, fieldList) {
   var self = this;

   return Promise.all(fieldList.map(function(name) {
      return self.check(obj.hasOwnProperty(name), Validator.Tags.missingField, [name]);
   }))
}

module.exports = Validator;
