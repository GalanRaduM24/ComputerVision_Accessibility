const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Plugin to add packaging options to build.gradle to resolve duplicate files
 */
const withPackagingOptions = (config) => {
  return withAndroidManifest(config, async (config) => {
    // Use a custom gradle.properties file
    if (!config.modResults._internal) {
      config.modResults._internal = {};
    }
    
    if (!config.modResults._internal.modResults) {
      config.modResults._internal.modResults = {};
    }
    
    if (!config.modResults._internal.modResults.mainApplicationId) {
      config.modResults._internal.modResults.mainApplicationId = {};
    }

    // Add the packaging options to build.gradle via prebuild script
    config.modResults._internal.scripts = config.modResults._internal.scripts || {};
    config.modResults._internal.scripts.prebuild = config.modResults._internal.scripts.prebuild || [];
    
    // Script to modify app/build.gradle
    config.modResults._internal.scripts.prebuild.push(`
      const fs = require('fs');
      const path = require('path');
      
      // Path to build.gradle
      const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
      
      // Read the build.gradle file
      let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
      
      // Check if packaging options already exist
      if (!buildGradleContent.includes('packaging {')) {
        // Find a good spot to insert the packaging block (after android { declaration)
        const androidBlockIndex = buildGradleContent.indexOf('android {');
        
        if (androidBlockIndex !== -1) {
          // Find the opening brace position
          const openingBraceIndex = buildGradleContent.indexOf('{', androidBlockIndex);
          
          // Position to insert after opening brace and a new line
          const insertPosition = openingBraceIndex + 1;
          
          // Packaging options to add
          const packagingOptions = \`
    packaging {
        resources {
            // Exclude duplicate META-INF files
            excludes += [
                "META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version",
                "META-INF/proguard/**",
                "META-INF/MANIFEST.MF",
                "META-INF/NOTICE",
                "META-INF/LICENSE",
                "META-INF/*.properties",
                "META-INF/*.txt"
            ]
            pickFirsts += [
                "META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version"
            ]
        }
    }
\`;
          
          // Insert the packaging options
          buildGradleContent = 
            buildGradleContent.substring(0, insertPosition) + 
            packagingOptions + 
            buildGradleContent.substring(insertPosition);
          
          // Write the modified content back to the file
          fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
          console.log('Added packaging options to build.gradle');
        } else {
          console.warn('Could not find android { in build.gradle');
        }
      } else {
        console.log('Packaging options already exist in build.gradle');
      }
    `);
    
    console.log('Added script to include packaging options in build.gradle');
    return config;
  });
};

module.exports = createRunOncePlugin(
  withPackagingOptions,
  'withPackagingOptions',
  '1.0.0'
); 