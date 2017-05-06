/**
 * Migrating users will have a localstorage item set. This means their location is London.
 * @returns {boolean}
 */
function isMigration(){
  try {
    return !!(window.localStorage.getItem('belfastsalah_setting::showDisclaimer') || window.localStorage.getItem('belfastsalah_setting::showTrackingDisclaimer'));
  } catch (e){
    return false;
  }
}

function getLegacySetting(settingName : string, defaultSetting : any){
  try{
    let item = window.localStorage.getItem(`belfastsalah_setting::${settingName}`);
    if(item){
      return JSON.parse(item);
    } else {
      return defaultSetting;
    }
  } catch (e){
    return defaultSetting;
  }
}

export const defaultSettings = {
  notifications: getLegacySetting('notifications', true),
  notifyMinutes: getLegacySetting('notifyMinutes', 5),
  hanafiAsr: getLegacySetting('hanafiAsr', false),
  showDisclaimer: getLegacySetting('showDisclaimer', true),
  nightMode: getLegacySetting('nightMode', false),
  nightModeMaghrib: false,
  showTrackingDisclaimer: getLegacySetting('showTrackingDisclaimer', true),
  location: isMigration() ? 'london' : null
};
