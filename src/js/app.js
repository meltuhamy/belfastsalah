var belfastsalah = {
  constants: angular.module('belfastsalah.constants', []),
  controllers: angular.module('belfastsalah.controllers', ['belfastsalah.constants']),
  services: angular.module('belfastsalah.services', ['belfastsalah.constants', 'angularMoment']),
  filters: angular.module('belfastsalah.filters', [])
};

belfastsalah.app = angular.module('belfastsalah', ['ionic', 'belfastsalah.controllers', 'belfastsalah.services', 'belfastsalah.constants', 'belfastsalah.filters', 'angularMoment', 'ngCordova'])
.run(function($ionicPlatform, Ticker, Notify, Settings, $rootScope) {
  $rootScope.VERSION = window.VERSION;
  Settings.loadAll();
  
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }

    // start the time ticker
    Ticker.start();
    Notify.scheduleDay();
    
  });
})

.config(function($stateProvider, $urlRouterProvider) {
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
