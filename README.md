# Prayer times


This is an Ionic app that displays prayer times from a prayer times table.

## Features
* Prayer times directly from mosque prayer time table
* Realtime countdown to next prayer
* Notifications when it's time to pray!
* Automatically enable night mode during the night
* Clean, simple design. Under 5mb size!

Supported locations:
* Belfast (Belfast Islamic Centre, NIMFA)
* London (London Unified Islamic Time Table)

## Live app
- [Android](https://play.google.com/store/apps/details?id=com.meltuhamy.londonsalah)
- [iOS](https://itunes.apple.com/gb/app/london-prayer-times/id993461657)

## Development

Git clone this repo, then run the following commands in the project directory:

```bash
npm install
npm install -g ionic cordova
ionic serve
```

## Contributing

Feel free to create a pull request.

## Add a new location

1. Copy the London time table and paste it into a new file in the same directory, e.g. `cp src/assets/prayertimes/london.json src/assets/prayertimes/mylocation.json`
2. Update the options in the settings screen in `src/providers/prayertimes.ts`

e.g. 
```typescript
alert.addInput({
  type: 'radio',
  label: 'My Location',
  value: 'mylocation',
  checked: previousLocation === 'mylocation'
});
```
