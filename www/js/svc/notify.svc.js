belfastsalah.svc.factory('Notify', function(PrayerTimes, $cordovaLocalNotification, $rootScope, Settings, $q, mixpanel){

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

    var formatNotification = function(notifyDate, prayerDate, index){
      var names = ['', '', 'Fajr', 'Shuruq', 'Duhr', 'Asr', 'Asr', 'Maghrib', 'Isha'];
      var displayTitle = names[index] + ' is at ' + moment(prayerDate).format('h:mm a');

      var formattedNotification = {
        id: index,
        title: displayTitle,
        at: notifyDate,
        data: { prayerName: names[index] }
      };

      var numMinutes = Settings.get('notifyMinutes');
      if(numMinutes > 0){
        formattedNotification.text = '' + numMinutes + ' minute reminder';
      }

      return formattedNotification;
    };

    var addToSequence = function(timeString, index, baseDate){
      if(timeString && timeString.indexOf(':') !== -1){
        var hanafiAsr = Settings.get('hanafiAsr');
        if((index === PrayerTimes.KEYS.asr && hanafiAsr) || (index === PrayerTimes.KEYS.asr2 && !hanafiAsr)){
          return;
        }
        var prayerDate = PrayerTimes.timeToDate(baseDate, timeString);
        var notifyDate = moment(prayerDate).subtract(Settings.get('notifyMinutes'),'minutes').toDate();
        if(notifyDate > todayDate && notifyDate <= oneDayLaterDate){
          scheduledNotifications.push(formatNotification(notifyDate, prayerDate, index));
        }
      }
    };

    _.forEach(times, function(v,i){addToSequence(v, i, date)});
    _.forEach(oneDayLaterTimes, function(v,i){addToSequence(v, i, oneDayLaterDate)});

    cancelAll().then(function(){
      window.cordova && $cordovaLocalNotification.schedule(scheduledNotifications);
      mixpanel.track('Schedule');
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

  var trackingSarted = false;
  function startTracking(){
    if(trackingSarted || !window.cordova) return;

    function flattenNotification(notification){
      var notificationData;
      try {
        notificationData = JSON.parse(notification.data);
      } catch (e){
        notificationData = {not_json: true};
      }
      for(var k in notificationData){
        if(notificationData.hasOwnProperty(k)){
          notification['data_'+k] = notificationData[k];
        }
      }
      return notification;
    }

    //A local notification was triggered.
    $rootScope.$on('$cordovaLocalNotification:trigger', function (e, notification, state) {
      mixpanel.track('Notification: trigger', _.merge({appState: state}, flattenNotification(notification)));
    });

    //A local notification was cleared from the notification center.
    $rootScope.$on('$cordovaLocalNotification:clear', function (e, notification, state) {
      mixpanel.track('Notification: clear', _.merge({appState: state}, flattenNotification(notification)));
    });

    //All local notifications were cleared from the notification center.
    $rootScope.$on('$cordovaLocalNotification:clearall', function (e, state) {
      mixpanel.track('Notification: clearall', {appState: state});
    });

    //A local notification was clicked.
    $rootScope.$on('$cordovaLocalNotification:click', function (e, notification, state) {
      mixpanel.track('Notification: click', _.merge({appState: state}, flattenNotification(notification)));
    });


    trackingSarted = true;
  }

  return {
    scheduleDay: scheduleDay,
    cancelAll: cancelAll,
    startTracking: startTracking
  };
});
