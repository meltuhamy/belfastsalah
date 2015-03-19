describe('MonthCtrl', function(){
  beforeEach(module('belfastsalah'));

  var ctrl, scope, PrayerTimes;

  var helpers = {
  };

  beforeEach(inject(function($controller, $rootScope, _PrayerTimes_){
    scope = $rootScope.$new();

    PrayerTimes = _PrayerTimes_;

    spyOn(PrayerTimes, 'getByMonth').and.callThrough();

    helpers.initController = function(month){
      return ctrl = $controller('MonthCtrl', { $scope: scope, $stateParams: {month: month} });
    };
    
  }));

  it('should get prayer times for a given month', function(){
    var givenMonth = (new Date()).getMonth()+1;
    var givenMonthName = 
    helpers.initController(givenMonth);
    expect(PrayerTimes.getByMonth).toHaveBeenCalledWith(givenMonth);
    expect(scope.rows).toBeTruthy();
    expect(scope.monthName).toBeTruthy();
  });

});