import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import subDays from 'date-fns/sub_days';
import addDays from 'date-fns/add_days';
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now';
import format from 'date-fns/format';
import 'rxjs/add/operator/toPromise';
import {Observable} from "rxjs";
import {Settings} from "./settings";
import { Storage } from '@ionic/storage';
import { AlertController } from 'ionic-angular';


const STORAGE_KEY = '_prayer';


export const tick = Observable.interval(1000).map(() => new Date());

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
  maghrib: PrayerTimeTime;
  isha: PrayerTimeTime;


  constructor(data: string[]){
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
      let prayerTimeDay = new PrayerTimeDay(dayData);
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
    let usingHanafiAsr = this.getOption('hanafiAsr');

    let possibilities = [
      dayBeforeTimes.isha,
      dayTimes.fajr,
      dayTimes.shuruq,
      dayTimes.duhr,
      usingHanafiAsr ? dayTimes.asr2 : dayTimes.asr,
      dayTimes.maghrib,
      dayTimes.isha,
      dayAfterTimes.fajr
    ];

    let minDistance;
    let timeToCompare = date.getTime();
    let resultIndex;

    // TODO: Can optimize using binary search
    possibilities.forEach((possiblePrayerTime, index) => {
      let currentTime = possiblePrayerTime.toDate(date).getTime();
      let distance = Math.abs(timeToCompare - currentTime);
      if (resultIndex === undefined || (distance < minDistance && currentTime > timeToCompare)) {
        resultIndex = index;
        minDistance = distance
      }
    });



    return {next: possibilities[resultIndex], prev: possibilities[resultIndex-1]};
  }




}

@Injectable()
export class PrayerTimes{
  cachedPrayerTimesTable : PrayerTimesTable;

  constructor(public http: Http, public settings: Settings, public storage: Storage, public alertCtrl : AlertController) {
  }

  getJsonFromAsset(resourceName: string) : Promise<any>{
    return this.http.get(`./assets/prayertimes/${resourceName}.json`).toPromise().then(response => response.json());
  }

  getPreferredTimeTableFromAssetAndSave(): Promise<PrayerTimesTable>{
    return this.settings.load()
      .then(() => this.settings.getValue('location'))
      .then(location => {
        if(location){
          return this.getJsonFromAsset(location);
        } else {
          return new Promise(resolve => {
            let alert = this.alertCtrl.create();
            alert.setTitle('Choose location');

            alert.addInput({
              type: 'radio',
              label: 'London',
              value: 'london',
              checked: true
            });

            alert.addInput({
              type: 'radio',
              label: 'Belfast',
              value: 'belfast',
              checked: false
            });

            alert.addButton({
              text: 'OK',
              handler: selectedLocation => {
                resolve(this.settings.setValue('location', selectedLocation).then(() => this.getJsonFromAsset(selectedLocation)));
              }
            });
            alert.present();
          });

        }
      })
      .then(timeTableJson => this.setTimeTableJson(timeTableJson))
      .then(savedTimeTableJson => new PrayerTimesTable(savedTimeTableJson));
  }

  setTimeTableJson(timeTableJson : any) : Promise<any> {
    return this.storage.set(STORAGE_KEY, timeTableJson);
  }

  getTimeTable() : Promise<PrayerTimesTable> {
    if(this.cachedPrayerTimesTable){
      return Promise.resolve(this.cachedPrayerTimesTable);
    } else {
      return this.storage.get(STORAGE_KEY).then(prayerTimesJson => {
        if(prayerTimesJson){
          return new PrayerTimesTable(prayerTimesJson);
        } else {
          return this.getPreferredTimeTableFromAssetAndSave();
        }
      });
    }
  }
}
