import { Injectable } from '@angular/core';
import {LocalNotifications} from '@ionic-native/local-notifications';


@Injectable()
export class Notifications {
  constructor(public localNotifications : LocalNotifications){

  }

  test(){
    this.localNotifications.schedule({
      title: 'Hello'
    })
  }
}
