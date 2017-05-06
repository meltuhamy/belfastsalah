import { Component } from '@angular/core';

import {NavController, ToastController} from 'ionic-angular';
import {FormBuilder, FormGroup} from "@angular/forms";
import {Settings} from "../../providers/settings";
import {PrayerTimes} from "../../providers/prayertimes";

@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html'
})
export class SettingsPage {

  settingsReady = false;

  options: any;

  form: FormGroup;


  constructor(public navCtrl: NavController, public settings: Settings, public formBuilder: FormBuilder, public prayerTimes: PrayerTimes, public toastCtrl : ToastController) {
  }

  clickLocation(){
    this.settings.setValue('location', '').then(() => {
      this.prayerTimes.getTimeTable({useCache: false}).then(() => {
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
      this.settings.merge(this.form.value);
    });
  }

  ionViewDidLoad() {
    // Build an empty form for the template to render
    this.form = this.formBuilder.group({});
  }


  ionViewWillEnter() {
    // Build an empty form for the template to render
    this.form = this.formBuilder.group({});


    this.settings.load().then(() => {
      this.settingsReady = true;
      this.options = this.settings.allSettings;

      this._buildForm();
    });
  }

}
