import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule } from 'ionic-angular';
import { Storage, IonicStorageModule } from '@ionic/storage'
import { PrayerTimesApp } from './app.component';
import { MonthPage, MonthSelector } from '../pages/month/month';
import { SettingsPage } from '../pages/settings/settings';
import { MinuteSelectorModal } from '../pages/settings/minute-selector-modal';
import { TodayPage } from '../pages/today/today';
import { TabsPage } from '../pages/tabs/tabs';
import { PrayerTimes } from "../providers/prayertimes";
import { PrayerItemComponent } from './prayer-item.component';
import { PrayerGridComponent } from './prayer-grid.component';
import { Settings } from '../providers/settings';
import { defaultSettings } from './defaultSettings';


import { BrowserModule } from '@angular/platform-browser';

import { HttpModule } from '@angular/http';

import {LocalNotifications} from '@ionic-native/local-notifications';
import {SplashScreen} from '@ionic-native/splash-screen';
import {StatusBar} from '@ionic-native/status-bar';

import {Notifications} from '../providers/notifications';

import {Analytics} from '../providers/analytics';

import { Device } from '@ionic-native/device';

import { TitleCasePipe } from './pipes';

import { Pro } from '@ionic/pro';
import {version as packageJsonVersion} from '../../package.json';

const IonicPro = Pro.init('6e868618', {
  appVersion: packageJsonVersion
});

export function provideSettings(storage: Storage) {
  return new Settings(storage, defaultSettings);
}

@NgModule({
  declarations: [
    PrayerTimesApp,
    MonthPage,
    MonthSelector,
    SettingsPage,
    MinuteSelectorModal,
    TodayPage,
    TabsPage,
    PrayerItemComponent,
    PrayerGridComponent,
    TitleCasePipe
  ],
  imports: [
    BrowserModule,
    HttpModule,
    IonicModule.forRoot(PrayerTimesApp),
    IonicStorageModule.forRoot()
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    PrayerTimesApp,
    MonthPage,
    SettingsPage,
    TodayPage,
    TabsPage,
    MonthSelector,
    MinuteSelectorModal
  ],
  providers: [
    { provide: Settings, useFactory: provideSettings, deps: [ Storage ] },
    PrayerTimes,
    LocalNotifications,
    Device,
    Notifications,
    SplashScreen,
    StatusBar,
    Analytics
  ]
})
export class AppModule {}
