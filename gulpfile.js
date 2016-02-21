var argv = require('yargs').argv;
var gulp = require('gulp');
var gutil = require('gulp-util');
var bower = require('bower');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var sh = require('shelljs');
var fs = require('fs');
var configValues = JSON.parse(fs.readFileSync('./config-values.json'));
var packageJSON = JSON.parse(fs.readFileSync('./package.json'));

var bump = require('gulp-bump');

// Basic usage:
// Will patch the version
gulp.task('bump', function(){
  var options;
  if(argv.version){
    options = {version: argv.version};
  } else if(argv.major){
    options = {type: 'major'};
  } else if(argv.minor){
    options = {type: 'minor'};
  } else if(argv.patch){
    options = {type: 'patch'};
  } else if(argv.prerelease){
    options = {type: 'prerelease'};
  } else {
    options = {type: 'patch'}
  }

  gulp.src('./package.json')
    .pipe(bump(options))
    .pipe(gulp.dest('./'));

});


function buildData(appName){
  var dataFile = './www/data.js';
  var appConfig = configValues[appName];
  appConfig.data = JSON.parse(fs.readFileSync(appConfig.data));
  appConfig.version = packageJSON.version;
  fs.writeFileSync(dataFile, 'window.APP_DATA = ' + JSON.stringify(appConfig) + ';');

  // now generate config.xml
  var configTemplate = '' + fs.readFileSync('./config.template.xml');
  var fleshedConfig = configTemplate.replace(/(?:<%=|<!--=)\s*(\S+)\s*(?:%>|-->)/g, function(match, key){
    return appConfig[key];
  });
  fs.writeFileSync('./config.xml', fleshedConfig);
}

var paths = {
  sass: ['./scss/**/*.scss']
};

gulp.task('default', ['london']);

gulp.task('sass', function(done) {
  gulp.src('./scss/ionic.app.scss')
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(gulp.dest('./www/css/'))
    .pipe(minifyCss({
      keepSpecialComments: 0
    }))
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('./www/css/'))
    .on('end', done);
});

gulp.task('watch', function() {
  gulp.watch(paths.sass, ['sass']);
});

gulp.task('install', [], function() {
  return bower.commands.install()
    .on('log', function(data) {
      gutil.log('bower', gutil.colors.cyan(data.id), data.message);
    });
});

gulp.task('belfast', ['sass'], function(){
  buildData('belfast');
});

gulp.task('london', ['sass'], function(){
  buildData('london');
});


gulp.task('release', ['sass'], function(){
  var argv = require('yargs')
    .usage('Usage: gulp release --app [belfast|london] --platform [android|ios]')
    .demand(['app','platform'])
    .argv;

  var app = argv.app;
  var platform = argv.platform;

  if (!(app == 'belfast' || app == 'london') || !(platform == 'ios' || platform == 'android')) {
    console.log('Usage: gulp release --app [belfast|london] --platform [android|ios]');
    sh.exit(1);
  }

  console.log('Building '+app);
  buildData(app);

  console.log('Running cordova build --release '+platform);
  if (sh.exec('cordova build --release ' + platform).code !== 0) {
    console.log('Error running '+ 'cordova build --release ' + platform);
    sh.exit(1);
  }

  function tag(){
    if (sh.exec('git tag -a release-'+packageJSON.version+'-'+app+'-'+platform+' -m "Release: '+packageJSON.version+'-'+app+'-'+platform+'"').code !== 0) {
      console.log('git tag -a release-'+packageJSON.version+'-'+app+'-'+platform+' -m "Release: '+packageJSON.version+'-'+app+'-'+platform+'"');
      sh.exit(1);
    }
  }

  if(platform == 'android'){
    console.log('Running jarsigner');
    var jarSignerProcess = sh.exec('jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore '+app+'.keystore ./platforms/android/build/outputs/apk/android-release-unsigned.apk alias_name', {async: true});
    jarSignerProcess.stdin.setEncoding('utf-8');
    var read = require('read');
    read({ prompt: 'Password: ', silent: true }, function(er, password) {
      jarSignerProcess.stdin.write(password+'\n');
    });

    jarSignerProcess.on('exit', function(code){
      if(code != 0){
        console.log('Error running jarsigner');
        sh.exit(1);
      }


      var timestamp = new Date().getTime();
      var apkName = app+'.'+packageJSON.version+'.'+timestamp+'.apk';

      console.log('Running zipalign');
      if (sh.exec('zipalign -v 4 ./platforms/android/build/outputs/apk/android-release-unsigned.apk '+apkName).code !== 0) {
        console.log('Error running zipalign -v 4 ./platforms/android/build/outputs/apk/android-release-unsigned.apk '+apkName);
        sh.exit(1);
      }

      console.log('Android build complete');
      tag();

    });

  } else {
    console.log('iOS build complete. Open project in xcode and build archive');
    tag();
  }
});
