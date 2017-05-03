import {Component} from '@angular/core';

import {NavController, NavParams, PopoverController, ViewController} from 'ionic-angular';
import {PrayerTimeDay, PrayerTimes, PrayerTimesTable} from "../../providers/prayertimes";

import format from 'date-fns/format';
import setMonth from 'date-fns/set_month';


@Component({
  template: `
    <ion-list radio-group [(ngModel)]="selectedMonthIndex" (ionChange)="changeMonth()" class="popover-page">
      <ion-item *ngFor="let month of months">
        <ion-label>{{month.name}}</ion-label>
        <ion-radio (click)="close()" [value]="month.index"></ion-radio>
      </ion-item>
    </ion-list>
  `
})
export class MonthSelector {
  months: { name: string, index: number }[];
  selectedMonthIndex: number;


  constructor(public navParams: NavParams, public viewCtrl: ViewController) {
    this.selectedMonthIndex = navParams.data.initialMonth;
    this.months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((name, index) => ({
      name,
      index
    }));
  }

  changeMonth() {
    this.navParams.data.onChange(this.selectedMonthIndex)
  }

  close(){
    this.viewCtrl.dismiss();
  }
}


@Component({
  selector: 'page-month',
  templateUrl: 'month.html'
})
export class MonthPage {
  currentMonth: PrayerTimeDay[];

  prayerTimesTable: PrayerTimesTable;

  today: Date;

  todayMonthName: string;

  constructor(public navCtrl: NavController, public prayerTimesService: PrayerTimes, private popoverCtrl: PopoverController) {
    this.initialise(new Date());
  }

  initialise(date: Date) {
    this.today = date;
    this.todayMonthName = format(this.today, 'MMMM');
    this.loadTimeTable().then(() => {
      this.currentMonth = this.prayerTimesTable.getByMonth(this.today.getMonth()).filter(i => !!i);
    });
  }

  loadTimeTable() {
    return this.prayerTimesService.getTimeTable().then(prayerTime => {
      this.prayerTimesTable = prayerTime;
    });
  }

  presentPopover(ev) {
    let popover = this.popoverCtrl.create(MonthSelector, {
      onChange: (month) => {
        this.initialise(setMonth(new Date(), month));
      },
      initialMonth: this.today.getMonth()
    });

    popover.present({
      ev: ev
    });
  }


}
