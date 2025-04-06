const { withAndroidManifest } = require('@expo/config-plugins');

// Plugin to add tools:replace="android:appComponentFactory" to the application tag
const withManifestOverride = (config) => {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults;

    // Ensure the tools namespace exists
    androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // Ensure the application tag exists
    if (!Array.isArray(androidManifest.manifest.application)) {
      console.warn('Manifest application tag not found');
      return config;
    }

    // Add the tools:replace attribute to the application tag
    androidManifest.manifest.application[0].$['tools:replace'] = 'android:appComponentFactory';
    
    // Also specify the actual appComponentFactory value
    androidManifest.manifest.application[0].$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
    
    console.log('Added tools:replace="android:appComponentFactory" and specified replacement value to AndroidManifest.xml');

    return config;
  });
};

module.exports = withManifestOverride; 