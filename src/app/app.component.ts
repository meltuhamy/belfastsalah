import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { TabsPage } from '../pages/tabs/tabs';
import { PrayerTimes } from "../providers/prayertimes";


@Component({
  templateUrl: 'app.html'
})
export class PrayerTimesApp {
  rootPage = TabsPage;

  constructor(platform: Platform, prayerTimes: PrayerTimes) {
    platform.ready().then(() => {
      StatusBar.styleDefault();
      Splashscreen.hide();
      prayerTimes.getFromAsset('london').then(results => window['pt'] = results);
    });
  }
}
