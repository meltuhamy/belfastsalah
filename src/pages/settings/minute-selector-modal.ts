import {NavParams, ViewController} from "ionic-angular";
import {Component} from "@angular/core";

@Component({
  templateUrl: 'minute-selector-modal.html'
})
export class MinuteSelectorModal {

  previousNotifyMinutes: number;
  newNotifyMinutes: number;

  constructor(navParams: NavParams, public viewCtrl: ViewController) {
    console.log('Starting a modal with params', navParams.data);
    this.previousNotifyMinutes = navParams.data.previousNotifyMinutes;
    this.newNotifyMinutes = this.previousNotifyMinutes;
  }

  dismiss(){
    this.viewCtrl.dismiss({newNotifyMinutes: this.newNotifyMinutes});
  }

}
