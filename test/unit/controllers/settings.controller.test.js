describe('SettingsCtrl', function(){
  beforeEach(module('belfastsalah'));

  var ctrl, scope, Settings, Notify, $window;

  beforeEach(inject(function($controller, $rootScope, _Settings_, _Notify_, _$window_, $httpBackend){
    scope = $rootScope.$new();

    Settings = _Settings_;
    Notify = _Notify_;
    $window = _$window_;

    $httpBackend.whenGET(/\.html/).respond(200);


    ctrl = $controller('SettingsCtrl', { $scope: scope });
  }));

  it('should allow opening a fork in a new window', function(){
    spyOn($window, 'open');
    scope.openFork();
    expect($window.open).toHaveBeenCalledWith('https://github.com/meltuhamy/belfastsalah', '_system');
  });

  it('should save notification minutes settings and reschedule notifications', function(){ 
    spyOn(Settings, 'setAndSave');
    spyOn(Notify, 'scheduleDay');
    scope.settings.notifyMinutes = 123;
    scope.saveNotifyMinutes();
    expect(Settings.setAndSave).toHaveBeenCalledWith('notifyMinutes', 123);
    expect(Notify.scheduleDay).toHaveBeenCalled();
  });

  it('should reschedule notifications when the notifications are turned on', function(){
    if(scope.settings.notifications){
      // turn it off
      scope.settings.notifications = false;
    }
    scope.$apply();

    spyOn(Notify, 'scheduleDay');
    spyOn(Notify, 'cancelAll');
    spyOn(Settings, 'setAndSave');


    scope.settings.notifications = true;
    scope.$apply();
    expect(Notify.scheduleDay).toHaveBeenCalled();
    expect(Notify.cancelAll).not.toHaveBeenCalled();
    expect(Settings.setAndSave).toHaveBeenCalledWith('notifications', true);

  });

  it('should cancel all notifications when the notifications are turned off', function(){
    if(!scope.settings.notifications){
      // turn it on
      scope.settings.notifications = true;
    }
    scope.$apply();

    spyOn(Notify, 'scheduleDay');
    spyOn(Notify, 'cancelAll');
    spyOn(Settings, 'setAndSave');


    scope.settings.notifications = false;
    scope.$apply();
    expect(Notify.scheduleDay).not.toHaveBeenCalled();
    expect(Notify.cancelAll).toHaveBeenCalled();
    expect(Settings.setAndSave).toHaveBeenCalledWith('notifications', false);
  });

});