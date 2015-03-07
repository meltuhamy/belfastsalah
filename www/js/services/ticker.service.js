belfastsalah.services.factory('Ticker', function($interval, $rootScope, EVENTS){
  var intervalId;
  var interval = 1000;

  function start () {
    stop();
    intervalId = $interval(onTick, interval);
  }

  function stop () {
    if(angular.isDefined(intervalId)){
      $interval.cancel(intervalId);
      intervalId = undefined;
    }
  }

  function onTick () {
    $rootScope.$broadcast(EVENTS.TICK, new Date());
  }

  return {
    start: start,
    stop: stop
  }
});