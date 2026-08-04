# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

**This project is pinned to SDK 54 on purpose** — it is what the Expo Go on the
owner's phone runs. npm publishes 57 as `latest`, and both 57 and 56 answer
"incompatible SDK version" on that device. Do not bump the SDK to match npm;
match whatever Expo Go actually installs, or move to a development build and
stop caring about Expo Go's version at all.

Two things bite when changing SDK: `node_modules` from the previous SDK will not
resolve against the new one (delete it and `package-lock.json`), and a plugin
that exists in one SDK may not in another — `expo-status-bar` in `app.json`
plugins made `expo config` exit 1 with no message on 54. `npx expo-doctor` finds
both.
