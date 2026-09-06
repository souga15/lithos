import React, { useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function LITHOSWebView() {
  const webviewRef = useRef(null);

  // The development URL for the Vite server (based on provided .env)
  // IMPORTANT: For real devices to access this, your laptop and phone must be on the SAME Wi-Fi
  // and your Vite server needs to run on --host (e.g., `npm run dev -- --host`)
  const WEB_APP_URL = 'http://10.151.63.12:5173';

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide the status bar overlay on Android to give it a full-screen app feel */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <WebView
        ref={webviewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // Add paddingTop for Android notch safety
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  webview: {
    flex: 1,
  },
});
