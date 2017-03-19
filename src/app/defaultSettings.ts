/**
 * Migrating users will have a localstorage item set. This means their location is London.
 * @returns {boolean}
 */
function isMigration(){
  return !!(window.localStorage.getItem('belfastsalah_setting::showDisclaimer') || window.localStorage.getItem('belfastsalah_setting::showTrackingDisclaimer'));
}

export const defaultSettings = {
};

if(isMigration()){
  defaultSettings['location'] = 'london';
}
