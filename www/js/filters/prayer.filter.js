belfastsalah.filters.filter('prayer', function(PrayerTimes){
  return function(input, format){
    if(angular.isUndefined(format)){
      return 'Fajr: '+input[PrayerTimes.KEYS.fajr]
           +' Shuruq: '+input[PrayerTimes.KEYS.shuruq]
           +' Duhr: '+input[PrayerTimes.KEYS.duhr]
           +' Asr: '+input[PrayerTimes.KEYS.asr]
           +(input[PrayerTimes.KEYS.asr2] ? (' Hanafi Asr: ' + input[PrayerTimes.KEYS.asr2]) : '')
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

    return input[PrayerTimes.KEYS[format]];
  };
});