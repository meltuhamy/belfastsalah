belfastsalah.svc.factory('mixpanel', function($http){
  var QUEUE = 'mpq';
  var TRACKING_ENDPOINT = 'https://api.mixpanel.com/';
  var RETRY_DELAY = 5000;
  var BATCH_SIZE = 4;
  var MP_TOKEN = '3f6dfebf2558c9e31c205a753e893b72';

  var pushTimeout, idCounter, registrationProperties = {token : MP_TOKEN, distinct_id: _.uniqueId('lodash')};

  function persist(key, value){
    var valueCompressed = LZString.compress(JSON.stringify(value));
    window.localStorage.setItem(key, valueCompressed);
  }

  function restore(key){
    var item = window.localStorage.getItem(key);
    if(item){
      return JSON.parse(LZString.decompress(item));
    } else {
      return undefined;
    }
  }

  function getQueue(batchSize, endpoint){
    var queue = restore(QUEUE);
    if(!queue){
      queue = [];
      persist(QUEUE, queue);
    }

    if(endpoint){
      queue = _.filter(queue, ['endpoint', endpoint]);
    }

    return _.take(queue, batchSize || queue.length);
  }

  function saveQueue(queue){
    persist(QUEUE, queue);
  }

  var base64 = window.Base64;

  function pushToQueue(val){
    var queue = getQueue();
    var newLength = queue.push(val);
    saveQueue(queue);

    return newLength;
  }


  function track(event, properties){
    var nowTime = new Date().getTime();
    var newLength = pushToQueue({
      event: event,
      properties: _.merge({time: nowTime}, registrationProperties, properties || {}),
      timeTracked: nowTime,
      id: idCounter++,
      endpoint: 'track'
    });

    if(newLength > 4){
      push();
    } else {
      schedulePush();
    }
  }

  function peopleSet(properties){
    var nowTime = new Date().getTime();
    var newLength = pushToQueue({
      properties: {
        $time: nowTime,
        $distinct_id: registrationProperties.distinct_id,
        $token: registrationProperties.token,
        $set: properties
      },
      timeTracked: nowTime,
      id: idCounter++,
      endpoint: 'engage'
    });

    if(newLength > 4){
      push();
    } else {
      schedulePush();
    }
  }

  function schedulePush(){
    if(pushTimeout){
      clearTimeout(pushTimeout);
    }

    pushTimeout = setTimeout(push, RETRY_DELAY);
  }

  function preProcessTrackQueue(queue){
    var nowTime = new Date().getTime();
    return queue.map(function (queueItem) {
      return {
        event: queueItem.event,
        properties: _.merge({
          timeToTrack: nowTime - queueItem.timeTracked,
          time: queueItem.timeTracked
        }, queueItem.properties )
      };
    });
  }

  function preProcessEngageQueue(queue){
    return queue.map(function (queueItem) {
      return queueItem.properties;
    });
  }

  function removeQueueItems(removeThese){
    var queue = getQueue();
    _.pullAllBy(queue, removeThese, 'id');
    saveQueue(queue);
  }

  function push(){
    if(pushTimeout){
      clearTimeout(pushTimeout);
    }
    // check if connection
    if(navigator.connection && navigator.connection.type !== navigator.connection.NONE){
      // connection seems ok, let's try sending
      doPost('track', getQueue(BATCH_SIZE, 'track'));
      doPost('engage', getQueue(BATCH_SIZE, 'engage'));
    } else {
      schedulePush();
    }
  }

  function doPost(endpoint, subQueue){
    if(subQueue.length === 0){
      idCounter = 0;
      return;
    }
    var preProcessQueue = endpoint === 'track' ? preProcessTrackQueue : preProcessEngageQueue;
    var queueEncoded = base64.encode(JSON.stringify(preProcessQueue(subQueue)));

    $http.post(TRACKING_ENDPOINT+endpoint+'/', {data: queueEncoded}, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      transformRequest: function(obj) {
        var str = [];
        for(var p in obj) {
          str.push(p + "=" + obj[p]);
        }
        return str.join("&");
      }

    }).then(function pushSuccess(){
      removeQueueItems(subQueue);
      schedulePush();

    }, function pushFail(){
      schedulePush();
    });
  }


  function register(properties){
    _.merge(registrationProperties, properties);
  }

  function identify(id){
    registrationProperties.distinct_id = id;
    window.mixpanel.identify(id);

  }

  return _.defaults({
    schedulePush: schedulePush,
    track: track,
    register: register,
    identify: identify,
    peopleSet: peopleSet
  }, window.mixpanel);
});
