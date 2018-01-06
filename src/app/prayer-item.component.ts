import {Component, Input} from "@angular/core";
import {PrayerTimeTime} from "../providers/prayertimes";
import format from 'date-fns/format';
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now';

@Component({
  selector: 'prayer-item',
  template: `
<ion-row class="prayer-item__row">
  <ion-col text-center><p>{{getFormattedPrayerName()}}</p></ion-col>
  <ion-col text-center><p>{{getFormattedPrayerTime()}}</p></ion-col>
</ion-row>`,
  styles: [`
:host {
  margin-top: 5px;
  margin-bottom: 5px;
 
}

:host:last-child {
  margin-bottom: 0;
}

:host:first-child {
  margin-top: 0;
}
`]
})
export class PrayerItemComponent {
  @Input() prayer : PrayerTimeTime;

  constructor() {

  }

  getFormattedPrayerName() : string {
    if(!this.prayer) return '';
    return ({
      fajr: 'Fajr',
      shuruq: 'Shuruq',
      duhr: 'Duhr',
      asr: 'Asr',
      asr2: 'Asr',
      maghrib: 'Maghrib',
      isha: 'Isha'
    })[this.prayer.type];
  }

  getFormattedPrayerTime() : string {
    if(!this.prayer) return '';
    return format(this.prayer.toDate(), 'HH:mm');
  }

  timeAgo() : string {
    if(!this.prayer) return '';
    return distanceInWordsToNow(this.prayer.toDate(), {includeSeconds: true, addSuffix: true});
  }
}
