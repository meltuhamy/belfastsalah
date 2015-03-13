belfastsalah.services.factory('Notify', function(PrayerTimes, $cordovaLocalNotification){
  var notifications = {};


  /**
   * Schedules 24 hours worth of prayer notification, starting on given date
   */
  function scheduleDay(date){
    date = date || new Date();
    var todayDate = new Date();
    var oneDayLaterDate = moment(date).add(1, 'days').toDate();

    var times = PrayerTimes.getByDate(date);
    var oneDayLaterTimes = PrayerTimes.getByDate(oneDayLaterDate);

    // times = ["3", "13", "05:04", "06:42", "12:35", "14:19", null, "18:26", "19:58"];
    // oneDayLaterTimes = ["3", "14", "05:02", "06:39", "12:34", "15:39", null, "18:28", "20:00"];

    console.info('times ', times);
    console.info('oneDayLaterTimes ', oneDayLaterTimes);

    var scheduledNotifications = [];
    
    var formatNotification = function(date, index){
      var names = ['', '', 'Fajr', 'Shuruq', 'Duhr', 'Asr', 'Hanafy Asr', 'Maghrib', 'Isha'];
      return {
        id: date.getTime(),
        text: 'Time for ' + names[index] + '!',
        at: date
      };
    };

    var addToSequence = function(timeString, index, baseDate){
      if(timeString && timeString.indexOf(':') !== -1){
        var prayerDate = PrayerTimes.timeToDate(baseDate, timeString);
        if(prayerDate > todayDate && prayerDate <= oneDayLaterDate){
          scheduledNotifications.push(formatNotification(prayerDate, index));
        }
      }
    };

    _.forEach(times, function(v,i){addToSequence(v, i, date)});
    _.forEach(oneDayLaterTimes, function(v,i){addToSequence(v, i, oneDayLaterDate)});

    console.log('Scheduling: ', scheduledNotifications);
    window.cordova && $cordovaLocalNotification.add(scheduledNotifications).then(function(){
      console.log('Added notifications', scheduledNotifications);
    });

  }

  function cancelAll(){
    window.cordova && $cordovaLocalNotification.cancelAll().then(function () {
      console.log('Cancelled all notifications');
    });
  }

  return {
    scheduleDay: scheduleDay,
    cancelAll: cancelAll
  };
});