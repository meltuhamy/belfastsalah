import { Injectable } from '@angular/core';

import { Storage } from '@ionic/storage';

const CACHED_PROMISE_TTL = 1000;
@Injectable()
export class Settings {
  private SETTINGS_KEY: string = '_settings';

  settings: any;

  _defaults: any;
  _readyPromise: Promise<any>;

  cachedPromise: Promise<any>;
  cachedPromiseTimestamp: number;

  constructor(public storage: Storage, defaults: any) {
    this._defaults = defaults;
  }

  load({useCache = true} = {}) : Promise<any>{
    if(this.settings && useCache){
      // already loaded!
      return Promise.resolve(this.settings);
    } else {
      let nowTimestamp = new Date().getTime();
      if(useCache && this.cachedPromise && this.cachedPromiseTimestamp && (this.cachedPromiseTimestamp + CACHED_PROMISE_TTL) > nowTimestamp){
        return this.cachedPromise;
      }
      this.cachedPromiseTimestamp = nowTimestamp;
      this.cachedPromise = this.storage.get(this.SETTINGS_KEY).then((value) => {
        if(value) {
          this.settings = value;
          this._mergeDefaults(this._defaults);
          return this.settings;
        } else {
          return this.setAll(this._defaults).then((val) => {
            this.settings = val;
            return this.settings;
          })
        }
      });
      return this.cachedPromise;
    }

  }

  _mergeDefaults(defaults: any) {
    for(let k in defaults) {
      if(!(k in this.settings)) {
        this.settings[k] = defaults[k];
      }
    }
    return this.setAll(this.settings);
  }

  merge(settings: any) {
    for(let k in settings) {
      this.settings[k] = settings[k];
    }
    return this.save();
  }

  setValue(key: string, value: any) {
    this.settings[key] = value;
    return this.storage.set(this.SETTINGS_KEY, this.settings);
  }

  setAll(value: any) {
    return this.storage.set(this.SETTINGS_KEY, value);
  }

  getValue(key: string) {
    return this.storage.get(this.SETTINGS_KEY)
      .then(settings => {
        return settings[key];
      });
  }

  save() {
    return this.setAll(this.settings);
  }

  get allSettings() {
    return this.settings;
  }
}
