import {Injectable} from '@angular/core';
import {LocalNotifications, ILocalNotification} from '@ionic-native/local-notifications';
import {PrayerTimes, PrayerTimeTime} from "./prayertimes";
import {Settings} from "./settings";

import {Platform, ToastController} from 'ionic-angular';


import addDays from 'date-fns/add_days';
import subtractMinutes from 'date-fns/sub_minutes';
import addMinutes from 'date-fns/add_minutes';
import {Analytics} from "./analytics";

const NUM_DAYS_TO_SCHEDULE: number = 20;

@Injectable()
export class Notifications {
  constructor(public platform: Platform,
              public localNotifications: LocalNotifications,
              public toastCtrl: ToastController,
              public settings: Settings,
              public prayerTimes : PrayerTimes,
              public analytics: Analytics) {
  }

  schedule({showToast = false} = {}) {
    if(!this.platform.is('cordova')){
      return Promise.all([Promise.resolve()]);
    }
    return Promise.all([this.prayerTimes.getTimeTable(), this.settings.load()]).then(([prayerTimeTable]) => {
      const notificationsEnabled = this.settings.allSettings.notifications;
      const notifyMinutes = this.settings.allSettings.notifyMinutes;
      if (!notificationsEnabled) {
        return this.cancelAll()
      }

      const todayDate = new Date();

      let notificationId = 0;

      const scheduledNotifications: ILocalNotification[] = [];

      for (let dayNum = 0; dayNum < NUM_DAYS_TO_SCHEDULE; dayNum++) {
        const laterDate = addDays(todayDate, dayNum);
        const oneDayLaterDate = addDays(laterDate, 1);
        const times = prayerTimeTable.getByDate(laterDate);

        ['fajr', 'shuruq', 'duhr', 'preferredAsr', 'maghrib', 'isha'].forEach(prayerName => {
          const prayer: PrayerTimeTime = times[prayerName];
          const prayerDate = prayer.toDate();
          const notifyDate = subtractMinutes(prayerDate, notifyMinutes);
          if (notifyDate > todayDate && notifyDate <= oneDayLaterDate) {
            const notification: ILocalNotification = {
              id: notificationId++,
              title: `${prayer.name} is at ${prayer.formattedDate()}`,
              at: notifyDate,
              data: {prayerName}
            };

            if (notifyMinutes > 0) {
              notification.text = `${notifyMinutes} minute reminder`;
            }

            scheduledNotifications.push(notification);
          }

        });
      }

      // add one more notification to remind the user to open the app!
      scheduledNotifications.push({
        id: notificationId++,
        title: `Still need prayer reminders?`,
        text: `Tap here to enable notifications`,
        at: addMinutes(scheduledNotifications[scheduledNotifications.length - 1].at, 10),
        data: {finalNotificationReminder: true}
      });

      return this.cancelAll()
        .then(() => {
          return this.localNotifications.schedule(scheduledNotifications);
        })
        .then(() => {
          if(showToast){
            this.toastCtrl.create({message: 'Notifications scheduled successfully', duration: 1600}).present();
          }
        });

    });

  }

  startTracking(){
    // Available events: schedule, trigger, click, update, clear, clearall, cancel, cancelall


    function notificationProperties(notification, state){
      let notificationData;
      try {
        notificationData = JSON.parse(notification.data);
      } catch (e){
        notificationData = {not_json: true};
      }

      notification.appState = state;

      for(let k in notificationData){
        if(notificationData.hasOwnProperty(k)){
          notification['data_'+k] = notificationData[k];
        }
      }
      return notification;
    }

    this.localNotifications.on('schedule', () => this.analytics.track('Notification: schedule'));
    this.localNotifications.on('trigger', (e, n, a) => this.analytics.track('Notification: trigger', notificationProperties(n, a)));
    this.localNotifications.on('click', (e, n, a) => this.analytics.track('Notification: click', notificationProperties(n, a)));
    this.localNotifications.on('update', () => this.analytics.track('Notification: update'));
    this.localNotifications.on('clear', (e, n, a) => this.analytics.track('Notification: clearall', notificationProperties(n, a)));
    this.localNotifications.on('clearall', (e, appState) => this.analytics.track('Notification: clearall', {appState}));
    this.localNotifications.on('cancel', () => this.analytics.track('Notification: cancel'));
    this.localNotifications.on('cancelall', () => this.analytics.track('Notification: cancelall'));

  }

  cancelAll() {
    return this.localNotifications.cancelAll().then(() => new Promise(resolve => setTimeout(() => resolve(), 500)));

  }
}
