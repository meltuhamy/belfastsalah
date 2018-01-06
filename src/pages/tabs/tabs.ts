import { Component } from '@angular/core';

import { TodayPage } from '../today/today';
import { MonthPage } from '../month/month';
import { SettingsPage } from '../settings/settings';

@Component({
  templateUrl: 'tabs.html'
})
export class TabsPage {
  todayRoot: any = TodayPage;
  monthRoot: any = MonthPage;
  settingsRoot: any = SettingsPage;

  constructor() {

  }
}
