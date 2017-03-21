import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { Settings } from '../providers/settings';
import { Deploy } from '@ionic/cloud-angular';

@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;

  constructor(platform: Platform, settings: Settings, public deploy: Deploy) {
    settings.load()
      .then(() => platform.ready())
      .then(() => {
        StatusBar.styleDefault();
        Splashscreen.hide();
        this.checkForLatestAppVersion();
      });
  }

  checkForLatestAppVersion(){
    this.deploy.check().then((snapshotAvailable: boolean) => {
      if (snapshotAvailable) {
        this.deploy.download().then(() => {
          return this.deploy.extract().then(() => this.deploy.load());
        });
      }
    });
  }
}
