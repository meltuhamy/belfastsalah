import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
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

import { CloudSettings, CloudModule } from '@ionic/cloud-angular';

import { BrowserModule } from '@angular/platform-browser';

import { HttpModule } from '@angular/http';

import {LocalNotifications} from '@ionic-native/local-notifications';
import {SplashScreen} from '@ionic-native/splash-screen';

import {Notifications} from '../providers/notifications';

import { TitleCasePipe } from './pipes';

const cloudSettings: CloudSettings = {
  'core': {
    'app_id': '27a31d02'
  }
};

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
    IonicStorageModule.forRoot(),
    CloudModule.forRoot(cloudSettings)
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
  providers: [{provide: ErrorHandler, useClass: IonicErrorHandler}, { provide: Settings, useFactory: provideSettings, deps: [ Storage ] }, PrayerTimes, LocalNotifications, Notifications, SplashScreen]
})
export class AppModule {}
