belfastsalah.controllers.controller('SettingsCtrl', function($scope, $ionicModal, Settings, Notify, $window) {
  $scope.settings = Settings.getAll();

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
  }

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


});