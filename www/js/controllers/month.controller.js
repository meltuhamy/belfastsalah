belfastsalah.controllers.controller('MonthCtrl', function($scope, PrayerTimes, $stateParams) {
  var month = $stateParams.month;
  var months = ['','January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var today = new Date();
  if(month == (today.getMonth()+1)){
    // highlight today's date
    $scope.todayDay = today.getDate();
  }
  $scope.monthName = months[month];
  $scope.rows = PrayerTimes.getByMonth(month);
});