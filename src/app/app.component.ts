import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { Settings } from '../providers/settings';
import { Deploy } from '@ionic/cloud-angular';
import {Notifications} from "../providers/notifications";

@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;
  settings: any;

  constructor(public platform: Platform, settings: Settings, public deploy: Deploy, public notifications : Notifications) {
    settings.load()
      .then(() => platform.ready())
      .then(() => {
        StatusBar.styleDefault();
        Splashscreen.hide();
        this.checkForLatestAppVersion();
        this.scheduleNotifications();
        this.settings = settings.allSettings;
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
}
