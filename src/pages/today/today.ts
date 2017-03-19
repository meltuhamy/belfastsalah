import {Component} from '@angular/core';

import {NavController} from 'ionic-angular';
import {PrayerTimeDay, PrayerTimes, PrayerTimeTime, tick, PrayerTimesTable} from "../../providers/prayertimes";
import addDays from 'date-fns/add_days';

@Component({
  selector: 'page-today',
  templateUrl: 'today.html'
})
export class TodayPage {
  prayerTimesNow: PrayerTimeDay;
  prayerTimesTomorrow: PrayerTimeDay;
  nextPrayer: PrayerTimeTime;
  prevPrayer: PrayerTimeTime;
  currentDate: Date;
  prayerTimesTable: PrayerTimesTable;

  constructor(public navCtrl: NavController, public prayerTimesService : PrayerTimes) {
    prayerTimesService.getTimeTable().then(prayerTime => {
      this.prayerTimesTable = prayerTime;
      this.update(new Date());
      tick.subscribe(date => {
        console.info('Tick', date);
        this.update(date);
      });
    });
  }

  update(date : Date){
    this.prayerTimesNow = this.prayerTimesTable.getByDate(date);
    this.prayerTimesTomorrow = this.prayerTimesTable.getByDate(addDays(date, 1));
    let times = this.prayerTimesTable.getNextAndPrevPrayer(date);
    this.nextPrayer = times.next;
    this.prevPrayer = times.prev;
    this.currentDate = date;
  }


}

