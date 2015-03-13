belfastsalah.controllers.controller('SettingsCtrl', function($scope, $ionicModal, Settings) {
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
    window.open('https://github.com/meltuhamy/belfastsalah', '_system');
  }

  $scope.settings = Settings.getAll();

  function watchAndSave(setting){
    $scope.$watch('settings.'+setting, function(newVal, oldVal){
      if(newVal !== oldVal){
        Settings.setAndSave(setting, newVal);
      }
    })
  }

  _.forEach($scope.settings, function(value, setting){
    watchAndSave(setting);
  });


});