import {Component, Input} from "@angular/core";
import {PrayerTimeDay} from "../providers/prayertimes";

@Component({
  selector: 'prayer-grid',
  template: `
    <ion-grid>
        <prayer-item [prayer]="prayerTimeDay.fajr"></prayer-item>
        <prayer-item [prayer]="prayerTimeDay.shuruq"></prayer-item>
        <prayer-item [prayer]="prayerTimeDay.duhr"></prayer-item>
        <prayer-item [prayer]="prayerTimeDay.preferredAsr"></prayer-item>
        <prayer-item [prayer]="prayerTimeDay.maghrib"></prayer-item>
        <prayer-item [prayer]="prayerTimeDay.isha"></prayer-item>
    </ion-grid>
`
})
export class PrayerGridComponent {
  @Input() prayerTimeDay : PrayerTimeDay;

  constructor() {

  }
}
