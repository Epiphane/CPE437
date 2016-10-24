
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
   excessatts: "excessatts",        // Too many attempts for this challenge.
   oldPwdMismatch: "oldPwdMismatch"// Incorrect old password.
}

Validator.prototype.ok = function() {return !this.errors.length;}

// Check test.  If false, add an error with tag and possibly empty array
// of qualifying parameters, e.g. name of missing field if tag is
// Tags.missingField.  Close the response.
Validator.prototype.check = function(test, tag, params) {
   if (!test)
      this.errors.push({tag: tag, params: params});

   if (this.errors.length)
      this.closeResponse();

   return !this.errors.length;
}

Validator.prototype.closeResponse = function() {
   if (this.res) {
      this.res.status(400).json(this.errors);
      this.res = null;   // Preclude repeated closings
   }
}

// Somewhat like |check|, but designed to allow several chained checks
// in a row, finalized by a check call.
Validator.prototype.chain = function(test, tag, params) {
   if (!test) {
      this.errors.push({tag: tag, params: params});
   }
   return this;
}

Validator.prototype.checkAdmin = function() {
   return this.check(this.session && this.session.isAdmin(),
    Validator.Tags.noPermission);
}

Validator.prototype.checkAdminOrTeacher = function() {
   return this.check(this.session && (this.session.isAdmin() || this.session.isTeacher()),
    Validator.Tags.noPermission);
}

// Validate that AU is the specified person or is an admin
Validator.prototype.checkPrsOK = function(prsId) {

   return this.check(this.session &&
   (this.session.isAdmin() || this.session.id == prsId),
    Validator.Tags.noPermission);
}

// Check presence of truthy property in |obj| for all fields in fieldList
Validator.prototype.hasFields = function(obj, fieldList) {
   var self = this;

   fieldList.forEach(function(name) {
      self.chain(obj.hasOwnProperty(name), Validator.Tags.missingField, [name])
   });

   if (!this.ok())
      this.closeResponse();

   return this.ok();
}

module.exports = Validator;
