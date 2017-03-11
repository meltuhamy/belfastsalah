belfastsalah.svc.factory('Notify', function(PrayerTimes, $cordovaLocalNotification, $rootScope, Settings, $q, mixpanel){

  var notificationId = 1;

  /**
   * Schedules numDays [= 5 by default] days worth of prayer notification, starting on given date
   */
  function scheduleDay(date, numDays, getByDate){
    getByDate = getByDate || PrayerTimes.getByDate;
    if(!Settings.get('notifications')) return cancelAll();
    numDays = numDays || 5;

    var todayDate = new Date();
    date = date || todayDate;

    var scheduledNotifications = [];

    var formatNotification = function(notifyDate, prayerDate, index){
      var names = ['', '', 'Fajr', 'Shuruq', 'Duhr', 'Asr', 'Asr', 'Maghrib', 'Isha'];
      var displayTitle = names[index] + ' is at ' + moment(prayerDate).format('h:mm a');

      var formattedNotification = {
        id: notificationId++,
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
        var oneDayLaterDate = moment(baseDate).add(1, 'days').toDate();
        if(notifyDate > todayDate && notifyDate <= oneDayLaterDate){
          scheduledNotifications.push(formatNotification(notifyDate, prayerDate, index));
        }
      }
    };

    // schedule numDays days worth of notifications
    _.forEach(_.times(numDays), function (dayNum) {
      var laterDate = moment(date).add(dayNum, 'days').toDate();
      var times = getByDate(laterDate);
      console.log('getByDate('+laterDate+') => ', times);
      _.forEach(times, function(v,i){addToSequence(v, i, laterDate)});
    });

    console.log(scheduledNotifications.map(function(n){ return ({id: n.id, title: n.title, date: new Date(n.at)})}));

    cancelAll().then(function(){
      window.cordova && $cordovaLocalNotification.schedule(scheduledNotifications);
      mixpanel.track('Schedule');
    });

  }

  function cancelAll(){
    var deferred = $q.defer();

    if(!window.cordova){
      deferred.resolve();
    }

    $cordovaLocalNotification.cancelAll().then(function () {
      setTimeout(function () {
        notificationId = 0;
        deferred.resolve();
      }, 500); // 1 second later
    });

    return deferred.promise;
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

  belfastsalah.testScheduling = function () {
    var now = new Date();
    var delay = Settings.get('notifyMinutes');

    scheduleDay(now, 5, function (date) {
      // given a day, provide an array e.g.
      // ["3", "11", "04:43", "06:20", "12:15", "15:16", "16:04", "18:01", "19:23"]
      var mo = moment(now);
      var n1 = mo.add(delay, 'minutes').format('HH:mm');
      var n2 = mo.add(delay, 'minutes').format('HH:mm');
      var n3 = mo.add(delay, 'minutes').format('HH:mm');
      var n4 = mo.add(delay, 'minutes').format('HH:mm');
      var n5 = mo.add(delay, 'minutes').format('HH:mm');
      var n6 = mo.add(delay, 'minutes').format('HH:mm');
      var n7 = mo.add(delay, 'minutes').format('HH:mm');
      var result = ["" + (now.getMonth() + 1), "" + now.getDate(), n1, n2, n3, n4, n5, n6, n7];
      now = moment(now).add(8*delay, 'minutes').toDate();
      return result;
    });
  };

  return {
    scheduleDay: scheduleDay,
    cancelAll: cancelAll,
    startTracking: startTracking
  };
});
