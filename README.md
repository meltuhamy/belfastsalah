# Belfast Salah App

A very simple application that shows today's prayer times (including a countdown to the next prayer) as well as monthly prayer times. 

<img src="http://i.imgur.com/xPFvPhU.png" alt="Screenshot" style="max-width:300px">

Uses [Belfast Islamic Centre's prayer time table](http://www.belfastislamiccentre.org.uk/bic/prayer_timetable).

Built using [Ionic Framework](http://ionicframework.com/) in a day. [Read the blog post](http://meltuhamy.com/tech/dev/ionic-speed-writing-a-prayer-times-smartphone-app-in-a-day) for more information.

## Requirements

* Install [node](https://nodejs.org/) and [bower](http://bower.io/).
* Install ionic framework ```npm install -g cordova ionic```

## Building and running

1. Run ```npm install && bower install```.
2. Run ```ionic platform add [ios|android]```.
3. Run ```ionic serve``` to run in the browser for development mode.
4. Run ```ionic build``` and ```ionic emulate [ios][android]``` to run in an emulator.

## Roadmap
We can take this as far as we want :) Here are some ideas and implemented features: 

- [x] Show today's prayer times with count down for next prayer
- [x] Show this month's prayer times
- [x] Show any month's prayer times (let user select month to view)
- [x] Unit testing and continues builds with travis
- [x] Better dist builds (concatenation and optimization)
- [x] Android/iOS Notifications when prayer is approaching
- [ ] Iqamah times
  - [ ] Allow user to set iqamah times manually (based on user input formula e.g. '5 minutes after adhan')
  - [ ] Display today's iqamah times
  - [ ] Iqamah reminders
  - [ ] Iqamah reminders based on distance from mosque and transport method :)
- [ ] Generalise for other masjids/time tables
- [ ] Distribute on web (so you don't need to download the app)
  - [ ] Offline access
  - [ ] Chrome web app
