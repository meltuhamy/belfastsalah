import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { Settings } from '../providers/settings';
import { Deploy } from '@ionic/cloud-angular';
import {Notifications} from "../providers/notifications";
import {PrayerTimes, tick} from "../providers/prayertimes";

@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;
  settings: any;
  nextPrayerType: string;

  constructor(public platform: Platform, settings: Settings, public deploy: Deploy, public notifications : Notifications, public prayerTimes : PrayerTimes) {
    settings.load()
      .then(() => platform.ready())
      .then(() => {
        StatusBar.styleDefault();
        Splashscreen.hide();
        this.checkForLatestAppVersion();
        this.scheduleNotifications();
        this.settings = settings.allSettings;
        this.initialisePrayerTimes();
      });
  }

  checkForLatestAppVersion(){
    if(this.platform.is('cordova')){
      this.deploy.check().then((snapshotAvailable: boolean) => {
        if (snapshotAvailable) {
          this.deploy.download().then(() => {
            return this.deploy.extract().then(() => this.deploy.load());
          });
        }
      });
    }
  }

  scheduleNotifications(){
    if(this.platform.is('cordova')){
      return this.notifications.schedule({showToast: true});
    }
  }

  initialisePrayerTimes(){
    this.prayerTimes.getTimeTable().then(prayerTimes => {
      const {next} = prayerTimes.getNextAndPrevPrayer();
      this.nextPrayerType = next.type;
      tick.subscribe(value => {
        const {next} = prayerTimes.getNextAndPrevPrayer();
        this.nextPrayerType = next.type;
      });
    })
  }

  isNightMode(nightMode: boolean, nightModeMaghrib: boolean, nextPrayerType : string): boolean{
    if(nightMode && nightModeMaghrib){
      return ['isha', 'fajr', 'shuruq'].indexOf(nextPrayerType) >= 0;
    } else {
      return nightMode;
    }
  }
}
