belfastsalah.svc.factory('Storage', function($window){
  return {
    set: function(key, value) {
      $window.localStorage.setItem(key, JSON.stringify(value));
    },
    get: function(key) {
      return JSON.parse($window.localStorage.getItem(key) || 'null');
    }
  }
});
