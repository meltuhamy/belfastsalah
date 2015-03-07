belfastsalah.controllers.controller('MonthCtrl', function($scope, PrayerTimes) {
  $scope.selectedDate = new Date();
  $scope.todayDay = (new Date()).getDate();
  $scope.rows = PrayerTimes.getByMonth($scope.selectedDate.getMonth()+1);
});