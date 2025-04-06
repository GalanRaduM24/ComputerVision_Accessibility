const { withAppBuildGradle } = require('@expo/config-plugins');

const withGradleFixForDuplicates = (config) => {
  return withAppBuildGradle(config, async (config) => {
    // Add configurations block to handle dependency conflicts
    if (!config.modResults.contents.includes('configurations.all {')) {
      const configurationBlock = `
// Fix for duplicate classes error
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
        force 'androidx.versionedparcelable:versionedparcelable:1.1.1'
        
        // Exclude old support libraries
        exclude group: 'com.android.support', module: 'support-compat'
        exclude group: 'com.android.support', module: 'support-v4'
        exclude group: 'com.android.support', module: 'versionedparcelable'
    }
}
`;
      
      // Find the android block closing
      const androidPattern = /android\s*{[\s\S]*?}/m;
      const androidMatch = config.modResults.contents.match(androidPattern);
      
      if (androidMatch) {
        // Insert after the android block
        const insertIndex = androidMatch.index + androidMatch[0].length;
        config.modResults.contents = 
          config.modResults.contents.substring(0, insertIndex) + 
          configurationBlock + 
          config.modResults.contents.substring(insertIndex);
        
        console.log('Added dependency resolution strategy to app/build.gradle');
      } else {
        console.warn('Could not find android block in app/build.gradle');
      }
    }
    
    return config;
  });
};

module.exports = withGradleFixForDuplicates; 