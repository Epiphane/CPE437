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

               API.Enrs.Itms.get(enrollment.enrId)
                  .then(function(response) {
                     enrollment.items = response.data;

                     API.Crss.Itms.get(enrollment.courseName)
                        .then(function(response) {
                           var data = response.data.filter(function(item) {
                              for (var i in enrollment.items) {
                                 if (enrollment.items[i].itemId === item.id) {
                                    return false;
                                 }
                              }

                              return true;
                           });

                           scope.store[enrollment.courseName] = {
                              enrollment: enrollment,
                              items: data
                           };
                        });
                  });
            });
         });
   };

   scope.refreshEnrs();

   scope.getAttColor = function(att) {
      var styles = ['success', 'warning', 'danger'];

      return styles[2 - att.score] || "";
   };

   scope.buyItem = function(enrId, itemId) {
      API.Enrs.Itms.post(enrId, itemId).then(function() { 
         scope.refreshEnrs();
      });
   };
}])
