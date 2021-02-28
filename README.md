# Prayer times

This is an Ionic app that displays prayer times from a prayer times table.

## Features

- Prayer times directly from mosque prayer time table
- Realtime countdown to next prayer
- Notifications when it's time to pray!
- Automatically enable night mode during the night
- Clean, simple design. Under 5mb size!

Supported locations:

- Belfast (Belfast Islamic Centre, NIMFA)
- London (London Unified Islamic Time Table)

## Live app

- [Android](https://play.google.com/store/apps/details?id=com.meltuhamy.londonsalah)
- [iOS](https://itunes.apple.com/gb/app/london-prayer-times/id993461657)

## Development

Git clone this repo, then run the following commands in the project directory:

```bash
npm install
npm install -g ionic
ionic serve
```

## Contributing

You're welcome to modify the project as you wish and contribute back to this project.

- If you spot a bug, please create an issue on GitHub for it
- If you're fixing a bug or adding a feature, please create a PR and I'll be happy to review and merge your changes.
- If you're thinking of creating your own app with this app as a base, you're welcome to do so, but that app must also be open source. See the LICENSE file for more information.

### How do I add my own prayer times?

The prayer data can be found in src/prayer_data. The structure is LOCATION-YEAR.json, for example, `london-2024.json`. You can add a json file for each year in each location. The latest year information will be used to look up the prayer times.

If you're adding a new location that you want the user to be able to choose, you can modify the SetupPage.tsx file to add a new option.
