describe('PrayerTimes Service', function(){
  beforeEach(module('belfastsalah'));

  var ctrl, scope, PrayerTimes;

  var helpers = {
  };

  beforeEach(inject(function(_PrayerTimes_){
    PrayerTimes = _PrayerTimes_;
  }));

  it('should get prayer times for a given date', function(){
    var date = new Date();
    var times = PrayerTimes.getByDate(date);
    expect(times).toBeTruthy();
  });

  it('should get dst-offsetted prayer times for a given date', function(){
    // a date that isn't DST: 28 March.
    var date = new Date(2015, 2, 28);
    var times = PrayerTimes.getByDate(date);

    // a date that is dst: 29 march
    var dstDate = new Date(2015, 2, 29);
    var dstTimes = PrayerTimes.getByDate(dstDate);

    for(var i = 2; i < dstTimes.length; i++){
      if(dstTimes[i]){
        var hoursDST = +dstTimes[i].split(':')[0];
        var hoursNoDST = +times[i].split(':')[0];
        expect(Math.abs(hoursDST-hoursNoDST)).toEqual(1);
      }
    }
  });

  it('should get prayer times for a given month', function(){
    var date = new Date();
    var times = PrayerTimes.getByMonth(1);
    expect(times).toBeTruthy();
  });

  it('should get dst offsetted prayer times for a given month', function(){
    // in the month of march, the clocks change at some point.
    var monthTimes = PrayerTimes.getByMonth(3);
    var foundChange = false;
    var prevDayTimes = monthTimes[0];
    for(var i = 20; i < monthTimes.length; i++){
      var dayTimes = monthTimes[i];
      var hoursDST = +dayTimes.duhr.split(':')[0]; // duhr is always in the same hour.
      var hoursPrev = +prevDayTimes.duhr.split(':')[0];

      if(Math.abs(hoursDST-hoursPrev) == 1){
        foundChange = true;
        break;
      }

      prevDayTimes = dayTimes;

    }
    expect(foundChange).toBe(true);

  });

  it('should not get dst offsetted prayer times for a non-dst month', function(){
    // in the month of march, the clocks change at some point.
    var monthTimes = PrayerTimes.getByMonth(4);
    var foundChange = false;
    var prevDayTimes = monthTimes[0];
    for(var i = 20; i < monthTimes.length; i++){
      var dayTimes = monthTimes[i];
      var hoursDST = +dayTimes.duhr.split(':')[0]; // duhr is always in the same hour.
      var hoursPrev = +prevDayTimes.duhr.split(':')[0];

      if(Math.abs(hoursDST-hoursPrev) == 1){
        foundChange = true;
        break;
      }

      prevDayTimes = dayTimes;

    }
    expect(foundChange).toBe(false);

  });



});