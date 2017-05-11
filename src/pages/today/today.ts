import {ChangeDetectorRef, Component} from '@angular/core';
import {SplashScreen} from '@ionic-native/splash-screen';
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
  private tickSub;

  constructor(public navCtrl: NavController, public prayerTimesService : PrayerTimes, public splashScreen : SplashScreen, private cd : ChangeDetectorRef) {
  }

  loadTimeTable(){
    return this.prayerTimesService.getTimeTable().then(prayerTime => {
      this.prayerTimesTable = prayerTime;
      this.update(new Date());
    });
  }

  update(date : Date){
    if(this.prayerTimesTable){
      this.prayerTimesNow = this.prayerTimesTable.getByDate(date);
      this.prayerTimesTomorrow = this.prayerTimesTable.getByDate(addDays(date, 1));
      let times = this.prayerTimesTable.getNextAndPrevPrayer(date);
      this.nextPrayer = times.next;
      this.prevPrayer = times.prev;
      this.currentDate = date;
      this.cd.detectChanges();
    }
  }

  ionViewWillEnter() {
    this.loadTimeTable().then(() => {
      this.tickSub = tick.subscribe(date => {
        this.update(date);
      });
      this.splashScreen.hide();
    });
  }

  ionViewWillLeave(){
    if(this.tickSub) {
      this.tickSub.unsubscribe();
    }
  }


}

