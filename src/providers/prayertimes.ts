import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import subDays from 'date-fns/sub_days';
import addDays from 'date-fns/add_days';
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now';
import format from 'date-fns/format';
import 'rxjs/add/operator/toPromise';
import {Settings} from "./settings";
import { Storage } from '@ionic/storage';
import { AlertController } from 'ionic-angular';
import {SplashScreen} from "@ionic-native/splash-screen";


const STORAGE_KEY = '_prayer';

export class PrayerTimeTime {
  hours: number;
  minutes: number;
  type: string;
  name: string;
  formattedTime: string;
  day: number;
  month: number;

  constructor(stringTime : string, type: string, day: number, month: number){
    let split = stringTime.split(':');
    this.hours = +split[0];
    this.minutes = +split[1];
    this.type = type;
    this.day = day;
    this.month = month;
    this.name = ({
      fajr: 'Fajr',
      shuruq: 'Shuruq',
      duhr: 'Duhr',
      asr: 'Asr',
      asr2: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha'
    })[type];
  }

  toDate(baseDate: Date = new Date()): Date {
    return new Date(Date.UTC(baseDate.getFullYear(), this.month, this.day, this.hours, this.minutes, 0, 0));
  }

  formattedDate(){
    return format(this.toDate(), 'HH:mm');
  }

  timeAgo() : string{
    return distanceInWordsToNow(this.toDate(), {includeSeconds: true, addSuffix: true});
  }

}

export class PrayerTimeDay {
  month: number;
  day: number;
  fajr: PrayerTimeTime;
  shuruq: PrayerTimeTime;
  duhr: PrayerTimeTime;
  asr: PrayerTimeTime;
  asr2: PrayerTimeTime;
  preferredAsr: PrayerTimeTime;
  maghrib: PrayerTimeTime;
  isha: PrayerTimeTime;


  constructor(data: string[], options){
    this.month = +data[0] - 1; // to mach js date
    this.day = +data[1];
    this.fajr = new PrayerTimeTime(data[2], 'fajr', this.day, this.month);
    this.shuruq = new PrayerTimeTime(data[3], 'shuruq', this.day, this.month);
    this.duhr = new PrayerTimeTime(data[4], 'duhr', this.day, this.month);
    this.asr = new PrayerTimeTime(data[5], 'asr', this.day, this.month);
    this.maghrib = new PrayerTimeTime(data[7], 'maghrib', this.day, this.month);
    this.isha = new PrayerTimeTime(data[8], 'isha', this.day, this.month);

    // hanafi asr
    if(data[6]){
      this.asr2 = new PrayerTimeTime(data[6], 'asr2', this.day, this.month);
      this.preferredAsr = options.hanafiAsr ? this.asr2 : this.asr;
    } else {
      this.preferredAsr = this.asr;
    }
  }

  hasHanafiAsr(): boolean{
    return !!this.asr2;
  }
}

export class PrayerTimesTable{
  private months: PrayerTimeDay[][];
  private options: {};
  constructor(data: string[][], options: {} = {}){
    this.months = [];
    data.forEach((dayData) => {
      let prayerTimeDay = new PrayerTimeDay(dayData, options);
      if(!this.months[prayerTimeDay.month]){
        this.months[prayerTimeDay.month] = [];
      }
      this.months[prayerTimeDay.month][prayerTimeDay.day] = prayerTimeDay;
    });
    this.options = options;
  }

  getOption(option:string) : any {
    return this.options[option];
  }

  getDayBefore(date: Date = new Date(), daysOffset: number = 1) : PrayerTimeDay{
    return this.getByDate(subDays(date, daysOffset));
  }

  getDayAfter(date: Date = new Date(), daysOffset: number = 1) : PrayerTimeDay{
    return this.getByDate(addDays(date, daysOffset));
  }
  getByDate(date: Date): PrayerTimeDay {
    return this.months[date.getMonth()][date.getDate()];
  }

  getByMonth(month: number): PrayerTimeDay[] {
    return this.months[month];
  }

  getNextAndPrevPrayer(date: Date = new Date()) : {next: PrayerTimeTime, prev: PrayerTimeTime}{

    // today, tomorrow and yesterday's prayer times
    let dayTimes = this.getByDate(date);
    let dayAfterTimes = this.getDayAfter(date);
    let dayBeforeTimes = this.getDayBefore(date);
    let dayBefore = subDays(date, 1);
    let dayAfter = addDays(date, 1);

    let possibilities = [
      {prayer: dayBeforeTimes.isha, time: dayBeforeTimes.isha.toDate(dayBefore)},
      {prayer: dayTimes.fajr, time: dayTimes.fajr.toDate(date)},
      {prayer: dayTimes.shuruq, time: dayTimes.shuruq.toDate(date)},
      {prayer: dayTimes.duhr, time: dayTimes.duhr.toDate(date)},
      {prayer: dayTimes.preferredAsr, time: dayTimes.preferredAsr.toDate(date)},
      {prayer: dayTimes.maghrib, time: dayTimes.maghrib.toDate(date)},
      {prayer: dayTimes.isha, time: dayTimes.isha.toDate(date)},
      {prayer: dayAfterTimes.fajr, time: dayAfterTimes.fajr.toDate(dayAfter)}
    ];

    let future = possibilities.filter(v => v.time > date);
    let next = future[0].prayer;
    let prev = possibilities[possibilities.indexOf(future[0])-1].prayer;


    return {next, prev};
  }

  hasHanafiAsr(){
    return this.getByDate(new Date()).hasHanafiAsr();
  }




}

@Injectable()
export class PrayerTimes{
  cachedPrayerTimesTableJson : any;
  locationSelectorVisible: boolean;
  locationSelectorPromise;

  constructor(public http: Http, public settings: Settings, public storage: Storage, public alertCtrl : AlertController, public splashScreen : SplashScreen) {
    this.locationSelectorVisible = false;
  }

  selectLocation(previousLocation: string){
    if(this.locationSelectorVisible){
      return this.locationSelectorPromise;
    } else {
      this.locationSelectorPromise = new Promise(resolve => {
        let alert = this.alertCtrl.create({enableBackdropDismiss: false});
        alert.setTitle('Choose location');

        alert.addInput({
          type: 'radio',
          label: 'London',
          value: 'london',
          checked: previousLocation ? (previousLocation === 'london') : true
        });

        alert.addInput({
          type: 'radio',
          label: 'Belfast',
          value: 'belfast',
          checked: previousLocation === 'belfast'
        });

        alert.addButton({
          text: 'OK',
          handler: selectedLocation => {
            resolve(this.settings.setValue('location', selectedLocation).then(() => this.getJsonFromAsset(selectedLocation)));
          }
        });
        this.splashScreen.hide();
        alert.present();
      }).then(returned => {
        this.locationSelectorVisible = false;
        return returned;
      });
      this.locationSelectorVisible = true;
      return this.locationSelectorPromise;
    }
  }

  getJsonFromAsset(resourceName: string) : Promise<any>{
    return this.http.get(`./assets/prayertimes/${resourceName}.json`).toPromise().then(response => response.json());
  }

  getPreferredTimeTableFromAssetAndSave({saveToDb = false, previousLocation = ''} = {}): Promise<PrayerTimesTable>{
    return this.settings.load()
      .then(() => this.settings.getValue('location'))
      .then(location => {
        if(location){
          return this.getJsonFromAsset(location);
        } else {
          return this.selectLocation(previousLocation);
        }
      })
      .then(timeTableJson => this.setTimeTableJson(timeTableJson, {saveToDb}))
      .then(savedTimeTableJson => new PrayerTimesTable(savedTimeTableJson, this.settings.allSettings));
  }

  setTimeTableJson(timeTableJson : any, {saveToDb = false} = {}) : Promise<any> {
    this.cachedPrayerTimesTableJson = timeTableJson;
    if(saveToDb){
      return this.storage.set(STORAGE_KEY, timeTableJson);
    } else {
      return Promise.resolve(timeTableJson);
    }
  }

  getTimeTable({useCache = true, previousLocation = ''} = {}) : Promise<PrayerTimesTable> {
    return this.settings.load().then(() => {
      if(this.cachedPrayerTimesTableJson && useCache){
        return Promise.resolve(new PrayerTimesTable(this.cachedPrayerTimesTableJson, this.settings.allSettings));
      } else {
        return this.getPreferredTimeTableFromAssetAndSave({previousLocation});
      }
    });
  }
}
