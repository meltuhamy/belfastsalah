import { Component } from '@angular/core';

import {NavController, ToastController} from 'ionic-angular';
import {FormBuilder, FormGroup} from "@angular/forms";
import {Settings} from "../../providers/settings";
import {PrayerTimes} from "../../providers/prayertimes";
import {Notifications} from "../../providers/notifications";

@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html'
})
export class SettingsPage {

  settingsReady = false;

  options: any;

  form: FormGroup;

  hasHanafiAsr: false;


  constructor(public navCtrl: NavController, public settings: Settings, public formBuilder: FormBuilder, public prayerTimes: PrayerTimes, public toastCtrl : ToastController, public notifications : Notifications) {
  }

  clickLocation(){
    let previousLocation = this.settings.allSettings.location;
    this.settings.setValue('location', '').then(() => {
      this.prayerTimes.getTimeTable({useCache: false, previousLocation}).then(() => this.notifications.schedule()).then(() => {
        this.initialise();
        this.toastCtrl.create({message: 'Location changed', duration: 1600}).present();
      });
    });

  }

  _buildForm(){
    let group: any = {
      notifications: [this.options.notifications],
      hanafiAsr: [this.options.hanafiAsr],
      nightMode: [this.options.nightMode],
      nightModeMaghrib: [this.options.nightModeMaghrib],
    };

    this.form = this.formBuilder.group(group);

    this.form.valueChanges.subscribe((v) => {
      const oldNotificationSetting = this.settings.allSettings.notifications;
      const oldHanafiSetting = this.settings.allSettings.hanafiAsr;
      this.settings.merge(this.form.value).then(() => {
        // if notifications changed, we need to re-schedule
        if(oldNotificationSetting !== v.notifications){
          return this.notifications.schedule().then(() => {
            if(v.notifications){
              this.toastCtrl.create({message: 'Notifications enabled', duration: 1600}).present();
            } else {
              this.toastCtrl.create({message: 'Notifications disabled', duration: 1600}).present();
            }
          });
        }

        // If hanafi asr has changed, re-schedule
        if(oldHanafiSetting !== v.hanafiAsr){
          this.notifications.schedule();
        }

      });

    });
  }

  ionViewDidLoad() {
    // Build an empty form for the template to render
    this.form = this.formBuilder.group({});
  }


  ionViewWillEnter() {
    // Build an empty form for the template to render
    this.form = this.formBuilder.group({});
    this.initialise();
  }

  initialise() {
    this.settings.load().then(() => {
      this.options = this.settings.allSettings;
      this._buildForm();
    }).then(() => this.prayerTimes.getTimeTable())
      .then((prayerTimeTable) => {
        this.hasHanafiAsr = prayerTimeTable.hasHanafiAsr();
      })
      .then(() => this.settingsReady = true);
  }

}
