import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { Storage, IonicStorageModule } from '@ionic/storage'
import { PrayerTimesApp } from './app.component';
import { MonthPage } from '../pages/month/month';
import { SettingsPage } from '../pages/settings/settings';
import { TodayPage } from '../pages/today/today';
import { TabsPage } from '../pages/tabs/tabs';
import { PrayerTimes } from "../providers/prayertimes";
import { PrayerItemComponent } from './prayer-item.component';
import { PrayerGridComponent } from './prayer-grid.component';
import { Settings } from '../providers/settings';
import { defaultSettings } from './defaultSettings';

export function provideSettings(storage: Storage) {
  return new Settings(storage, defaultSettings);
}

@NgModule({
  declarations: [
    PrayerTimesApp,
    MonthPage,
    SettingsPage,
    TodayPage,
    TabsPage,
    PrayerItemComponent,
    PrayerGridComponent
  ],
  imports: [
    IonicModule.forRoot(PrayerTimesApp),
    IonicStorageModule.forRoot()
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    PrayerTimesApp,
    MonthPage,
    SettingsPage,
    TodayPage,
    TabsPage
  ],
  providers: [{provide: ErrorHandler, useClass: IonicErrorHandler}, { provide: Settings, useFactory: provideSettings, deps: [ Storage ] }, PrayerTimes]
})
export class AppModule {}
