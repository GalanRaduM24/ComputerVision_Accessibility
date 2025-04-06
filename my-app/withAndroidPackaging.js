const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Plugin to directly modify build.gradle to handle resource conflicts
 */
const withAndroidPackaging = (config) => {
  return withAppBuildGradle(config, (config) => {
    // Check if packaging options are already included
    if (config.modResults.contents.includes('packaging {')) {
      console.log('Packaging options already exist in build.gradle');
      return config;
    }
    
    // Find a suitable position to insert packaging options
    // Looking for android { block
    const androidBlockRegex = /android\s*{/g;
    const match = androidBlockRegex.exec(config.modResults.contents);
    
    if (!match) {
      console.warn('Could not find android { block in build.gradle');
      return config;
    }
    
    // Get position right after the opening brace
    const insertAtPosition = match.index + match[0].length;
    
    // Prepare the packaging options
    const packagingOptions = `
    // Added by expo-config-plugin to resolve resource conflicts
    packaging {
        resources {
            excludes += [
                "META-INF/proguard/**",
                "META-INF/MANIFEST.MF",
                "META-INF/NOTICE",
                "META-INF/LICENSE",
                "META-INF/*.properties",
                "META-INF/*.txt"
            ]
            pickFirsts += [
                // Handle specific conflict files
                "META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version",
                "META-INF/androidx.customview_customview.version",
                // Handle other potential version conflicts
                "META-INF/androidx**.version"
            ]
        }
    }
`;
    
    // Insert the packaging options into the contents
    const newContents = 
      config.modResults.contents.substring(0, insertAtPosition) + 
      packagingOptions + 
      config.modResults.contents.substring(insertAtPosition);
    
    // Update the build.gradle contents
    config.modResults.contents = newContents;
    
    console.log('Added packaging options to build.gradle');
    return config;
  });
};

module.exports = createRunOncePlugin(
  withAndroidPackaging,
  'withAndroidPackaging',
  '1.0.0'
); 