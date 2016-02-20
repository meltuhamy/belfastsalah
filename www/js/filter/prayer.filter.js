belfastsalah.filter.filter('prayer', function(PrayerTimes, Settings){
  return function(input, format){
    if(angular.isUndefined(format)){
      var hanafiAsr = Settings.get('hanafiAsr');
      return 'Fajr: '+input[PrayerTimes.KEYS.fajr]
        +' Shuruq: '+input[PrayerTimes.KEYS.shuruq]
        +' Duhr: '+input[PrayerTimes.KEYS.duhr]
        +' Asr: '+ (hanafiAsr ? input[PrayerTimes.KEYS.asr2] : input[PrayerTimes.KEYS.asr])
        +' Maghrib: '+input[PrayerTimes.KEYS.maghrib]
        +' Isha: '+input[PrayerTimes.KEYS.isha];
    }

    if(format === 'json'){
      var obj = {};
      for(var key in PrayerTimes.KEYS){
        if(PrayerTimes.hasOwnProperty(key)){
          var data = input[PrayerTimes.KEYS[key]];
          if(data) obj[key] = data;
        }
      }
      return obj;
    }
    return (format == 'asr' && Settings.get('hanafiAsr')) ?  input[PrayerTimes.KEYS.asr2] : input[PrayerTimes.KEYS[format]];
  };
});
