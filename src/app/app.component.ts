import { Component } from '@angular/core';
import {AlertController, Platform} from 'ionic-angular';
import { StatusBar } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { Settings } from '../providers/settings';
import { Deploy } from '@ionic/cloud-angular';
import {Notifications} from "../providers/notifications";
import {PrayerTimes, tick} from "../providers/prayertimes";
import {SplashScreen} from "@ionic-native/splash-screen";

@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;
  settings: any;
  nextPrayerType: string;

  constructor(public platform: Platform, settings: Settings, public deploy: Deploy, public notifications : Notifications, public prayerTimes : PrayerTimes, public alertCtrl : AlertController, public splashScreen: SplashScreen) {
    settings.load()
      .then(() => platform.ready())
      .then(() => {
        StatusBar.styleDefault();
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
          this.deploy.getMetadata().then((metadata) => {
            this.alertCtrl.create({
              title: 'Update available',
              message: `A new version of Prayer Times is available. ${(metadata && metadata.releaseNotes) || ''}`,
              buttons: [
                {
                  text: 'Cancel',
                  role: 'cancel',
                  handler: () => {

                  }
                },
                {
                  text: 'Update',
                  handler: () => {
                    setTimeout(() => {
                      this.alertCtrl.create({
                        title: 'Downloading update',
                        message: 'The app will restart automatically once this is done',
                        enableBackdropDismiss: false
                      }).present();
                    }, 100);

                    this.deploy.download().then(() => {
                      return this.deploy.extract().then(() => {
                        this.splashScreen.show();
                        return this.deploy.load();
                      });
                    });
                  }
                }
              ]
            }).present();
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
    return this.prayerTimes.getTimeTable().then(prayerTimes => {
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
