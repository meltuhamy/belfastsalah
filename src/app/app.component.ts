import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { Settings } from '../providers/settings';

@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;

  constructor(platform: Platform, settings: Settings) {
    settings.load()
      .then(() => platform.ready())
      .then(() => {
        StatusBar.styleDefault();
        Splashscreen.hide();
      });

  }
}
