belfastsalah.svc.factory('Settings', function(Storage, DEFAULT_SETTINGS){
  var setting_prefix = 'belfastsalah_setting::';
  var settings = angular.copy(DEFAULT_SETTINGS);

  function loadAll(){
    _.forEach(DEFAULT_SETTINGS, function(value, setting){
      load(setting);
    });
  }

  function load(setting){
    if(angular.isDefined(DEFAULT_SETTINGS[setting])){
      var result = Storage.get(setting_prefix+setting);
      var returned = result === null ? DEFAULT_SETTINGS[setting] : result;
      return set(setting, returned);
    }
  }

  function set(setting, value){
    if(angular.isDefined(DEFAULT_SETTINGS[setting])){
      settings[setting] = value;
      return true;
    }

    return false;
  }

  function setAndSave(setting, value){
    return set(setting, value) && save(setting, value);
  }

  function save(setting, value){
    if(angular.isDefined(DEFAULT_SETTINGS[setting])){
      Storage.set(setting_prefix + setting, value);
      return true;
    }

    return false;
  }

  function saveAll(){
    _.forEach(settings, function(value, setting){
      save(setting, value);
    });
  }

  function get(setting){
    return settings[setting];
  }

  function getAll(){
    return settings;
  }

  return {
    load: load,
    loadAll: loadAll,
    set: set,
    save: save,
    saveAll: saveAll,
    setAndSave: setAndSave,
    get: get,
    getAll: getAll
  };
});
