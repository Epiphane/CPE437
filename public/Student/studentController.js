app.controller('studentController', ['$scope', '$state', 'api', 'confirm', 'login', '$rootScope',
 function(scope, $state, API, confirm, login, $rootScope) {
   $rootScope.page = 'student';

   scope.store = {};

   if (!login.isLoggedIn()) {
      $state.go('home');
   }

   scope.refreshEnrs = function() {
      API.Prss.Enrs.get(scope.loggedUser.id)
         .then(function(response) {
            scope.enrollments = response.data;
            scope.store = {};

            scope.enrollments.forEach(function(enrollment) {
               API.Crss.Itms.get(enrollment.courseName)
                  .then(function(response) {
                     scope.store[enrollment.courseName] = {
                        creditsEarned: enrollment.creditsEarned,
                        items: response.data
                     };
                  })
            })
         });
   };

   scope.refreshEnrs();

   scope.getAttColor = function(att) {
      var styles = ['success', 'warning', 'danger'];

      return styles[2 - att.score] || "";
   };

   scope.buyItem = function(itmId) {
      console.log(itmId);
   }
}])
