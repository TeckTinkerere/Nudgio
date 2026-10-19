const {checkManifest} = require('../check-manifest');

const wrap = (inner, applicationAttrs = 'android:allowBackup="false"') =>
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">${inner}<application ${applicationAttrs}></application></manifest>`;

const withComponents = components =>
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:allowBackup="false">${components}</application></manifest>`;

describe('check-manifest', () => {
  it('passes a manifest whose only exported component is MainActivity', () => {
    const xml = withComponents(`
      <activity android:name=".MainActivity" android:exported="true">
        <intent-filter><action android:name="android.intent.action.MAIN"/></intent-filter>
      </activity>
      <receiver android:name=".alarm.AlarmDispatchReceiver" android:exported="false" />
      <provider android:name=".backup.MediaReminderFileProvider" android:exported="false"></provider>`);
    expect(checkManifest(xml)).toEqual([]);
  });

  it('flags an INTERNET permission but not one removed with tools:node', () => {
    expect(checkManifest(wrap('<uses-permission android:name="android.permission.INTERNET" />'))).toEqual([
      'declares android.permission.INTERNET',
    ]);
    expect(
      checkManifest(
        wrap('<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />'),
      ),
    ).toEqual([]);
  });

  it('flags a library component that is exported', () => {
    const xml = withComponents(
      '<activity android:name="com.example.lib.ShareActivity" android:exported="true"></activity>',
    );
    expect(checkManifest(xml)).toEqual(['exported activity com.example.lib.ShareActivity']);
  });

  it('treats an intent-filter with no explicit exported attribute as exported', () => {
    const xml = withComponents(`
      <receiver android:name="com.example.lib.BootReceiver">
        <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/></intent-filter>
      </receiver>`);
    expect(checkManifest(xml)).toEqual(['exported receiver com.example.lib.BootReceiver']);
  });

  it('allows an exported component only when it is behind the DUMP permission', () => {
    const guarded = withComponents(`
      <receiver android:name="androidx.profileinstaller.ProfileInstallReceiver"
        android:exported="true" android:permission="android.permission.DUMP">
        <intent-filter><action android:name="androidx.profileinstaller.action.INSTALL_PROFILE"/></intent-filter>
      </receiver>`);
    expect(checkManifest(guarded)).toEqual([]);

    const otherPermission = withComponents(`
      <receiver android:name="com.example.lib.R" android:exported="true"
        android:permission="com.example.CUSTOM"></receiver>`);
    expect(checkManifest(otherPermission)).toEqual(['exported receiver com.example.lib.R']);
  });

  it('requires allowBackup to be false', () => {
    expect(checkManifest(wrap('', 'android:allowBackup="true"'))).toEqual(['android:allowBackup is not "false"']);
    expect(checkManifest(wrap('', ''))).toEqual(['android:allowBackup is not "false"']);
  });
});
