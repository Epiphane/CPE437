var passport = require('passport');

// These are different types of authentication strategies that can be used with Passport.
// var LocalStrategy = require('passport-local').Strategy;
// var TwitterStrategy = require('passport-twitter').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
// var GoogleStrategy = require('passport-google').Strategy;
var config = require('./developmentKeys');

// Use facebook strategy
passport.use(new FacebookStrategy({
        clientID: config.facebook.clientID,
        clientSecret: config.facebook.clientSecret,
        callbackURL: config.facebook.callbackURL
    },
    function(accessToken, refreshToken, profile, done) {
        console.log("Here we go: atok: " + accessToken + " reftok: " + refreshToken + " profile: " + profile);
    }
));

module.exports = passport;
