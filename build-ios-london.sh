git checkout london
#keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
gulp
npm test
cordova build --release android
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore belfast.keystore ./platforms/android/ant-build/MainActivity-release-unsigned.apk alias_name
rm -f Release.apk && zipalign -v 4 ./platforms/android/ant-build/MainActivity-release-unsigned.apk Release.apk