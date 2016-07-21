app.controller('enrController', ['$scope', '$state', '$stateParams', 'api', 'confirm', 'login', '$rootScope',
 function(scope, $state, $stateParams, API, confirm, login, $rootScope) {
   $rootScope.page = 'student';

   scope.enrId = $stateParams.enrId;

   scope.inProgressChallenges = [];
   scope.challenges = [];
   scope.mappedChallenges = {};

   if (!login.isLoggedIn()) {
      $state.go('home');
   }

   scope.startChallenge = function(challengeName) {
      API.Prss.Atts.post(scope.loggedUser.id, challengeName)
         .then(scope.refreshAtts);
   };

   scope.refreshAtts = function() {
      API.Enrs.get(scope.enrId)
         .then(function(response) {
            scope.enrollment = response.data;

            return API.Enrs.Itms.get(scope.enrollment.enrId);
         })
         .then(function(response) {
            scope.items = response.data;

            return API.Crss.Itms.get(scope.enrollment.courseName);
         })
         .then(function(response) {
            scope.store = response.data.filter(function(item) {
               for (var i in scope.items) {
                  if (scope.items[i].itemId === item.id) {
                     return false;
                  }
               }

               return true;
            });
         });

      API.Enrs.Chls.get(scope.enrId).then(function(response) {
         scope.challenges = response.data;

         scope.challenges.forEach(function(challenge) {
            scope.mappedChallenges[challenge.name] = challenge;
         })
      });

      return API.Enrs.Atts.get(scope.enrId)
         .then(function(response) {
            scope.grouped = {};

            scope.inProgressChallenges = [];

            angular.forEach(response.data, function(attempt) {
               var challengeName = attempt.challengeName;

               scope.grouped[challengeName] = scope.grouped[challengeName] || [];

               scope.grouped[challengeName].unshift(attempt);
               if (scope.inProgressChallenges.indexOf(challengeName) < 0)
                  scope.inProgressChallenges.push(attempt.challengeName);
            });
         });
   };

   scope.isWithinDay = function(attempt, challengeName) {
      if (!scope.mappedChallenges[challengeName])
         return false;

      var closeTime = new Date(scope.mappedChallenges[challengeName].openTime)
      closeTime.setDate(closeTime.getDate() + 1);

      return closeTime >= attempt.startTime;
   }

   scope.notInProgress = function(challenge) {
      return scope.inProgressChallenges.indexOf(challenge.name) < 0;
   };

   scope.isOpen = function(challengeName) {
      return scope.mappedChallenges[challengeName] && scope.mappedChallenges[challengeName].attsAllowed > scope.grouped[challengeName].length;
   };

   scope.getAttColor = function(att) {
      var styles = ['success', 'warning', 'danger'];

      return styles[2 - att.score] || "";
   };

   scope.buyItem = function(enrId, itemId) {
      API.Enrs.Itms.post(enrId, itemId).then(function() { 
         scope.refreshAtts();
      });
   };

   scope.refreshAtts();
}])
