describe('TodayCtrl', function(){
  beforeEach(module('belfastsalah'));

  var ctrl, scope, PrayerTimes;

  beforeEach(inject(function($controller, $rootScope, _PrayerTimes_){
    scope = $rootScope.$new();

    PrayerTimes = _PrayerTimes_;

    spyOn(PrayerTimes, 'getByDate').and.callThrough();
    spyOn(PrayerTimes, 'getNextPrayer').and.callThrough();

    ctrl = $controller('TodayCtrl', { $scope: scope });
  }));

  it('should get initial prayer time values for today date', function(){
    expect(scope.tickerDate instanceof Date).toBe(true);
    expect(scope.tickerPrayerTimes).toBeDefined();
    expect(scope.nextPrayer).toBeDefined();
    expect(PrayerTimes.getByDate).toHaveBeenCalled();
    expect(PrayerTimes.getNextPrayer).toHaveBeenCalled();

  });

  it('should update prayer times on tick events', inject(function(EVENTS){
    var date = new Date();
    scope.$emit(EVENTS.TICK, date);
    expect(scope.tickerDate).toBe(date);
    expect(PrayerTimes.getByDate).toHaveBeenCalledWith(date);
    expect(PrayerTimes.getNextPrayer).toHaveBeenCalled();
  }));
});