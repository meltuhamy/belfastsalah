belfastsalah.controllers.controller('TodayCtrl', function($scope, EVENTS, PrayerTimes) {
  $scope.tickerDate = new Date();
  $scope.tickerPrayerTimes = PrayerTimes.getByDate($scope.tickerDate);
  $scope.nextPrayer = PrayerTimes.getNextPrayer($scope.tickerDate);

  
  var tickListener = $scope.$on(EVENTS.TICK, function(e, date){
    $scope.tickerDate = date;
    $scope.tickerPrayerTimes = PrayerTimes.getByDate($scope.tickerDate);
    $scope.nextPrayer = PrayerTimes.getNextPrayer($scope.tickerDate);
  });

  $scope.$on('$destroy', function(){
    tickListener();
  });

});