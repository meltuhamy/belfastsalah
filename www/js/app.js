var belfastsalah = {
  constant: angular.module('belfastsalah.constant', []),
  ctrl: angular.module('belfastsalah.ctrl', ['belfastsalah.constant']),
  svc: angular.module('belfastsalah.svc', ['belfastsalah.constant', 'angularMoment']),
  filter: angular.module('belfastsalah.filter', [])
};

belfastsalah.app = angular.module('belfastsalah', ['ionic', 'ngCordova', 'angularMoment', 'belfastsalah.constant', 'belfastsalah.ctrl', 'belfastsalah.svc', 'belfastsalah.filter'])
.run(function($ionicPlatform, Ticker, Notify, Settings, $rootScope, $ionicModal, mixpanel) {
  $rootScope.APP_DATA = window.APP_DATA;
  Settings.loadAll();
  $rootScope.nightMode = Settings.get('nightMode');
  $rootScope.currentMonth = new Date().getMonth() + 1;

  $ionicPlatform.ready(function() {
    var deviceStats = _.merge({},{
      appId: APP_DATA.id,
      appVersion: APP_DATA.appVersion,
      platformId: window.cordova ? window.cordova.platformId : 'web'
    }, _.clone(window.device));

    mixpanel.identify(window.device ? ((window.device.serial || '') + window.device.uuid) : 0);

    mixpanel.register(deviceStats);
    mixpanel.peopleSet(deviceStats);

    mixpanel.track('Ready');

    Notify.startTracking();

    mixpanel.peopleSet(_.clone(Settings.getAll()));
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);

    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }

    // start the time ticker
    Ticker.start();
    Notify.scheduleDay();

    if(Settings.get('showDisclaimer') || Settings.get('showTrackingDisclaimer')){
      $ionicModal.fromTemplateUrl('templates/modal-time-disclaimer.html', {
        animation: 'slide-in-up'
      }).then(function(modal) {
        modal.show();
        $rootScope.$on('modal.hidden', function() {
          Settings.setAndSave('showDisclaimer', false);
          Settings.setAndSave('showTrackingDisclaimer', false);
          mixpanel.track('Activated');
        });
      });
    }

  });
})

.config(function($stateProvider, $urlRouterProvider) {

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider
  // setup an abstract state for the tabs directive
    .state('tab', {
      url: "/tab",
      abstract: true,
      templateUrl: "templates/tabs.html"
    })

    // Each tab has its own nav history stack:

    .state('tab.today', {
      url: '/today',
      views: {
        'tab-today': {
          templateUrl: 'templates/tab-today.html',
          controller: 'TodayCtrl'
        }
      }
    })

    .state('tab.selectMonth', {
      url: '/month',
      views: {
        'tab-month': {
          templateUrl: 'templates/tab-select-month.html'
        }
      }
    })
    .state('tab.month', {
      url: '/month/:month',
      views: {
        'tab-month': {
          templateUrl: 'templates/tab-month.html',
          controller: 'MonthCtrl'
        }
      }
    })
    .state('tab.settings', {
      url: '/settings',
      views: {
        'tab-settings': {
          templateUrl: 'templates/tab-settings.html',
          controller: 'SettingsCtrl'
        }
      }
    })
    .state('tab.notify',{
      url: '/settings/notify',
      views: {
        'tab-settings': {
          templateUrl: 'templates/tab-notify.html',
          controller: 'SettingsCtrl'
        }
      }
    });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/tab/today');

});
