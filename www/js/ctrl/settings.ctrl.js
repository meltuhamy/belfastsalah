belfastsalah.ctrl.controller('SettingsCtrl', function($rootScope, $scope, $ionicModal, Settings, Notify, $window, PrayerTimes) {
  $scope.settings = Settings.getAll();
  $scope.hasHanafiAsr = PrayerTimes.hasHanafiAsr();

  $ionicModal.fromTemplateUrl('templates/modal-about.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.modal = modal;
  });

  $scope.openModal = function() {
    $scope.modal.show();
  };

  $scope.closeModal = function() {
    $scope.modal.hide();
  };

  //Cleanup the modal when we're done with it!
  $scope.$on('$destroy', function() {
    $scope.modal.remove();
  });

  $scope.openFork = function(){
    $window.open('https://github.com/meltuhamy/belfastsalah', '_system');
  };

  $scope.saveNotifyMinutes = function(){
    Settings.setAndSave('notifyMinutes', $scope.settings.notifyMinutes);
    Notify.scheduleDay();
  };

  $scope.$watch('settings.notifications', function(newVal, oldVal){
    if(newVal !== oldVal){
      if(newVal){
        Notify.scheduleDay()
      } else {
        Notify.cancelAll();
      }
      Settings.setAndSave('notifications', newVal);
    }
  });

  $scope.$watch('settings.hanafiAsr', function(newVal, oldVal){
    if(newVal !== oldVal){
      Settings.setAndSave('hanafiAsr', newVal);
      Notify.scheduleDay();
    }
  });

  $scope.$watch('settings.nightMode', function(newVal, oldVal){
    if(newVal !== oldVal){
      Settings.setAndSave('nightMode', newVal);
      $rootScope.nightMode = newVal;
    }
  });



});
