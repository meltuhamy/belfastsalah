import { Component } from '@angular/core';
import {AlertController, Platform} from 'ionic-angular';
import { StatusBar } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { Settings } from '../providers/settings';
import { Deploy } from '@ionic/cloud-angular';
import {Notifications} from "../providers/notifications";
import {PrayerTimes} from "../providers/prayertimes";
import {SplashScreen} from "@ionic-native/splash-screen";
import {TimerObservable} from "rxjs/observable/TimerObservable";
import {Subscription} from "rxjs/Subscription";
import {Analytics} from "../providers/analytics";

import {version as packageJsonVersion} from '../../package.json';
import {Device} from "@ionic-native/device";

@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;
  settings: any;
  nextPrayerType: string;
  subscription: Subscription;

  constructor(public platform: Platform,
              public settingsProvider: Settings,
              public deploy: Deploy,
              public notifications : Notifications,
              public prayerTimes : PrayerTimes,
              public alertCtrl : AlertController,
              public splashScreen: SplashScreen,
              public analytics : Analytics,
              public device : Device) {
    settingsProvider.load()
      .then(() => platform.ready())
      .then(() => {
        StatusBar.styleDefault();
        this.initialisePrayerTimes()
          .then(() => this.initialiseAnalytics())
          .then(() => this.checkForLatestAppVersion())
          .then(() => this.scheduleNotifications());
        this.settings = settingsProvider.allSettings;
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

      let timer = TimerObservable.create(2000, 1000);
      this.subscription = timer.subscribe(t => {
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

  initialiseAnalytics(){
    const deviceStats = Object.assign({},{
      appId: 'com.meltuhamy.londonsalah',
      appVersion: packageJsonVersion,
      platformId: this.device.platform
    }, Object.assign({
      cordova: this.device.cordova,
      model: this.device.model,
      platform: this.device.platform,
      uuid: this.device.uuid,
      version: this.device.version,
      manufacturer:  this.device.manufacturer,
      isVirtual: this.device.isVirtual,
      serial: this.device.serial
    }));

    this.analytics.identify((this.device.serial || '') + this.device.uuid);

    this.analytics.register(deviceStats);
    this.analytics.peopleSet(deviceStats);
    this.analytics.peopleSet(Object.assign({}, this.settings.allSettings));

    if(this.settingsProvider.allSettings.showDisclaimer || this.settingsProvider.allSettings.showTrackingDisclaimer){
      this.alertCtrl.create({
        title: `Disclaimer`,
        message: `This app uses your local device time.<br>It is up to you to ensure your device time is accurate. <br><br>By using this application, you agree to send us anonymous usage information. <br>We will use this information to improve your user experience. <br><br>This message will not be shown again.`,
      }).present().then(() => {
        this.settingsProvider.merge({showDisclaimer: false, showTrackingDisclaimer: false});
        this.analytics.track('Activated')
      });
    }

    this.analytics.track('Ready');
    this.notifications.startTracking();
  }
}
