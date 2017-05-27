import {Injectable} from "@angular/core";
import pullAllBy from 'lodash.pullallby';
import {Http} from "@angular/http";
import {Headers} from '@angular/http';
import 'rxjs/add/operator/toPromise';
import URLSearchParams from 'url-search-params';

const QUEUE = 'mpq';
const TRACKING_ENDPOINT = 'https://api.mixpanel.com/';
const RETRY_DELAY = 5000;
const BATCH_SIZE = 4;
const MP_TOKEN = '3f6dfebf2558c9e31c205a753e893b72';

@Injectable()
export class Analytics {
  registrationProperties: any;
  pushTimeout: number;
  idCounter: number;
  queueBuffer: any[];

  constructor(public http: Http){
    this.queueBuffer = [];
    this.idCounter = 0;
    this.registrationProperties = {token : MP_TOKEN, distinct_id: `lodash_${++this.idCounter}`};

    window.document.addEventListener('pause', () => {
      this.track('Pause Event');
      this.persist(QUEUE, this.queueBuffer);
      this.queueBuffer.length = 0;
    }, false);

    window.document.addEventListener('resume', () => {
      let queue = this.restore(QUEUE);
      if(!queue){
        queue = [];
        this.persist(QUEUE, queue);
      }
      this.queueBuffer = queue;
      this.track('Resume Event');
      this.schedulePush();
    }, false);
  }

  private persist(key : string, value : any){
    window.localStorage.setItem(key, JSON.stringify(value));
  }


  private restore(key) : any{
    let storedItems = [];
    try {
      storedItems = JSON.parse(window.localStorage.getItem(key));
    } catch (e){
    }

    // merge storedItems with current items
    let restored = this.queueBuffer;
    (storedItems || []).forEach(item => {
      if(!restored.find(queueItem => queueItem.id === item.id)){
        restored.push(item);
      }
    });
    return restored;
  }

  private getQueue(batchSize = 0, endpoint?){
    let queue = this.queueBuffer;
    if(endpoint){
      queue = queue.filter(item => item.endpoint === endpoint);
    }

    return queue.slice(0, batchSize || queue.length);
  }

  private pushToQueue(val){
    val.id = this.queueBuffer.push(val) + (new Date().getTime());
    console.info('Tracking', val);
    return val.id;
  }


  private preProcessTrackQueue(queue){
    const nowTime = new Date().getTime();
    return queue.map(queueItem => {
      return {
        event: queueItem.event,
        properties: Object.assign({
          timeToTrack: nowTime - queueItem.timeTracked,
          time: queueItem.timeTracked
        }, queueItem.properties )
      };
    });
  }

  private preProcessEngageQueue(queue){
    return queue.map(queueItem => queueItem.properties);
  }

  private removeQueueItems(removeThese){
    const queue = this.queueBuffer;
    pullAllBy(queue, removeThese, 'id');
    this.queueBuffer = queue;
  }

  private push(){
    if(this.pushTimeout){
      clearTimeout(this.pushTimeout);
    }
    this.doPost('track', this.getQueue(BATCH_SIZE, 'track'));
    this.doPost('engage', this.getQueue(BATCH_SIZE, 'engage'));
  }

  private doPost(endpoint, subQueue){
    if(subQueue.length === 0){
      return;
    }
    const preProcessQueue = endpoint === 'track' ? this.preProcessTrackQueue : this.preProcessEngageQueue;
    const queueEncoded = btoa(JSON.stringify(preProcessQueue(subQueue)));

    let body = new URLSearchParams();
    body.set('data', queueEncoded);

    let headers = new Headers();
    headers.append('Content-Type', 'application/X-www-form-urlencoded');

    console.info('Sending events: ', subQueue);
    this.http.post(`${TRACKING_ENDPOINT + endpoint}/`, body.toString(), {headers}).toPromise().then(() => {
      this.removeQueueItems(subQueue);
      this.schedulePush();
    }, () => {
      this.schedulePush();
    });
  }

  public track(event, properties = {}){
    const nowTime = new Date().getTime();
    this.pushToQueue({
      event: event,
      properties: Object.assign({time: nowTime}, this.registrationProperties, properties),
      timeTracked: nowTime,
      endpoint: 'track'
    });

    if(this.queueBuffer.length > 4){
      this.push();
    } else {
      this.schedulePush();
    }
  }

  public peopleSet(properties){
    const nowTime = new Date().getTime();
    this.pushToQueue({
      properties: {
        $time: nowTime,
        $distinct_id: this.registrationProperties.distinct_id,
        $token: this.registrationProperties.token,
        $set: properties
      },
      timeTracked: nowTime,
      endpoint: 'engage'
    });

    if(this.queueBuffer.length > 4){
      this.push();
    } else {
      this.schedulePush();
    }
  }

  public schedulePush(){
    if(this.pushTimeout){
      clearTimeout(this.pushTimeout);
    }

    this.pushTimeout = setTimeout(() => this.push(), RETRY_DELAY);
  }

  public register(properties){
    Object.assign(this.registrationProperties, properties);
  }

  public identify(id){
    this.registrationProperties.distinct_id = id;
  }
}
