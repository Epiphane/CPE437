app.controller('adminController',
['$scope', '$state', 'api', 'login', '$rootScope', '$timeout',
 function(scope, $state, API, login, $rootScope, $timeout) {
   $rootScope.page = 'admin';

   if (!login.isLoggedIn()) {
      $state.go('home');
   }

   scope.offsets = {
      ms: 0,
      sec: 0,
      min: 0,
      hr: 0,
      day: 0,
      month: 0,
      year: 0
   };

   scope.getTime = function() {
      var fakeDate = new Date();

      fakeDate.setFullYear(fakeDate.getFullYear() + scope.offsets.year);
      fakeDate.setMonth(fakeDate.getMonth() + scope.offsets.month);
      fakeDate.setDate(fakeDate.getDate() + scope.offsets.day);
      fakeDate.setHours(fakeDate.getHours() + scope.offsets.hr);
      fakeDate.setMinutes(fakeDate.getMinutes() + scope.offsets.min);
      fakeDate.setSeconds(fakeDate.getSeconds() + scope.offsets.sec);
      fakeDate.setMilliseconds(fakeDate.getMilliseconds() + scope.offsets.ms);

      return fakeDate;
   };

   scope.setOffset = function(offset) {
      var fakeDate = new Date();
      fakeDate.setTime(fakeDate.getTime() + offset);

      var realDate = new Date();

      scope.offsets.year  = fakeDate.getFullYear() - realDate.getFullYear();
      scope.offsets.month = fakeDate.getMonth() - realDate.getMonth();
      scope.offsets.day   = fakeDate.getDate() - realDate.getDate();
      scope.offsets.hr    = fakeDate.getHours() - realDate.getHours();
      scope.offsets.min   = fakeDate.getMinutes() - realDate.getMinutes();
      scope.offsets.sec   = fakeDate.getSeconds() - realDate.getSeconds();
      scope.offsets.ms    = fakeDate.getMilliseconds() - realDate.getMilliseconds();
   }

   scope.update = function() {
      API.Time.get().then(function(response) {
         var info = response.data;

         scope.setOffset(info.offset);
         tick();
      });
   }

   scope.update();

   function tick() {
      scope.time = scope.getTime();
      $timeout(tick, 1000);
   }

   scope.saveTime = function() {
      API.Time.put(scope.getTime())
         .then(function() {
            scope.update();
         })
   }
}])
