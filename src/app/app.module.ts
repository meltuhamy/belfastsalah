import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { IonicStorageModule } from '@ionic/storage'
import { PrayerTimesApp } from './app.component';
import { MonthPage } from '../pages/month/month';
import { SettingsPage } from '../pages/settings/settings';
import { TodayPage } from '../pages/today/today';
import { TabsPage } from '../pages/tabs/tabs';
import {PrayerTimes} from "../providers/prayertimes";
import { PrayerItemComponent } from './prayer-item.component';
import { PrayerGridComponent } from './prayer-grid.component';

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
  providers: [{provide: ErrorHandler, useClass: IonicErrorHandler}, PrayerTimes]
})
export class AppModule {}
