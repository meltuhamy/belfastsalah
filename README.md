# Belfast Salah App

A very simple application that shows today's prayer times (including a countdown to the next prayer) as well as monthly prayer times. 

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

