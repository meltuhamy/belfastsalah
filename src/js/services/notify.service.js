belfastsalah.services.factory('Notify', function(PrayerTimes, $cordovaLocalNotification, Settings, $q){

  /**
   * Schedules 24 hours worth of prayer notification, starting on given date
   */
  function scheduleDay(date){
    if(!Settings.get('notifications')) return cancelAll();
    
    date = date || new Date();
    var todayDate = new Date();
    var oneDayLaterDate = moment(date).add(1, 'days').toDate();

    var times = PrayerTimes.getByDate(date);
    var oneDayLaterTimes = PrayerTimes.getByDate(oneDayLaterDate);

    // times = ["3", "14", "05:04", "06:42", "09:22", "14:19", null, "16:44", "19:58"];
    // oneDayLaterTimes = ["3", "15", "05:02", "06:39", "12:34", "15:39", null, "18:28", "20:00"];

    var scheduledNotifications = [];
    
    var formatNotification = function(date, index){
      var names = ['', '', 'Fajr', 'Shuruq', 'Duhr', 'Asr', 'Hanafy Asr', 'Maghrib', 'Isha'];
      var notifyMinutes = Settings.get('notifyMinutes');
      var prayerName = names[index];

      var displayText;
      if(notifyMinutes == 0){
        displayText = prayerName + ' now!';
      } else if (notifyMinutes === 1){
        displayText = prayerName + ' in 1 minute!';
      } else {
        displayText = prayerName + ' in ' + notifyMinutes + ' minutes!';
      }

      return {
        id: index,
        text: displayText,
        at: date
      };
    };

    var addToSequence = function(timeString, index, baseDate){
      if(timeString && timeString.indexOf(':') !== -1){
        var prayerDate = moment(PrayerTimes.timeToDate(baseDate, timeString)).subtract(Settings.get('notifyMinutes'),'minutes').toDate();
        if(prayerDate > todayDate && prayerDate <= oneDayLaterDate){
          scheduledNotifications.push(formatNotification(prayerDate, index));
        }
      }
    };

    _.forEach(times, function(v,i){addToSequence(v, i, date)});
    _.forEach(oneDayLaterTimes, function(v,i){addToSequence(v, i, oneDayLaterDate)});

    cancelAll().then(function(){
      window.cordova && $cordovaLocalNotification.add(scheduledNotifications);
    });

  }

  function cancelAll(){
    if(!window.cordova){
      var deferred = $q.defer();
      deferred.resolve();
      return deferred.promise;
    }

    return $cordovaLocalNotification.cancelAll();
  }

  return {
    scheduleDay: scheduleDay,
    cancelAll: cancelAll
  };
});