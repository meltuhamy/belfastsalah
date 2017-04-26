import { Component } from '@angular/core';

import { NavController } from 'ionic-angular';
import {PrayerTimeDay, PrayerTimes, PrayerTimesTable} from "../../providers/prayertimes";

@Component({
  selector: 'page-month',
  templateUrl: 'month.html'
})
export class MonthPage {
  currentMonth: PrayerTimeDay[];

  prayerTimesTable: PrayerTimesTable;

  constructor(public navCtrl: NavController, public prayerTimesService : PrayerTimes) {
    this.loadTimeTable().then(() => {
      this.currentMonth = this.prayerTimesTable.getByMonth(new Date().getMonth()).filter(i => !!i);
      console.log(this.currentMonth);
    });
  }

  loadTimeTable(){
    return this.prayerTimesService.getTimeTable().then(prayerTime => {
      this.prayerTimesTable = prayerTime;
    });
  }


}
