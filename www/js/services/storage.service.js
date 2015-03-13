belfastsalah.services.factory('Storage', function($window){
  return {
    set: function(key, value) {
      $window.localStorage[key] = JSON.stringify(value);
    },
    get: function(key) {
      var result;
      return JSON.parse($window.localStorage[key] || 'null');
    }
  }
});