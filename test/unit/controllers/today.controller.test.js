describe('TodayCtrl', function(){
  beforeEach(module('belfastsalah'));

  var ctrl, scope;

  beforeEach(inject(function($controller, $rootScope){
    scope = $rootScope.$new();
    ctrl = $controller('TodayCtrl', { $scope: scope });
  }));

  it('should work', function(){
    expect(true).toBe(true);
  });
});