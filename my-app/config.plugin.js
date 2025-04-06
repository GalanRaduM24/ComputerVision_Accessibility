const { withAndroidManifest, withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

const withComprehensiveAndroidFixes = (config) => {
  // Apply the manifest override
  config = withAndroidManifest(config, async (config) => {
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

  // Apply Gradle fixes for duplicate classes
  config = withAppBuildGradle(config, (config) => {
    // Add configurations block to handle dependency conflicts
    if (!config.modResults.contents.includes('configurations.all {')) {
      const configurationBlock = `
// Fix for duplicate classes error
configurations.all {
    resolutionStrategy {
        force 'androidx.core:core:1.13.1'
        force 'androidx.versionedparcelable:versionedparcelable:1.1.1'
        force 'androidx.customview:customview:1.1.0'
        force 'androidx.localbroadcastmanager:localbroadcastmanager:1.0.0'
        
        // Exclude old support libraries
        exclude group: 'com.android.support', module: 'support-compat'
        exclude group: 'com.android.support', module: 'support-v4'
        exclude group: 'com.android.support', module: 'versionedparcelable'
        exclude group: 'com.android.support', module: 'customview'
        exclude group: 'com.android.support', module: 'localbroadcastmanager'
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
    
    // Add packaging options
    if (!config.modResults.contents.includes('packaging {')) {
      // Find position to insert packaging options
      const androidBlockRegex = /android\s*{/g;
      const match = androidBlockRegex.exec(config.modResults.contents);
      
      if (match) {
        // Find the opening brace position
        const openingBraceIndex = match.index + match[0].length;
        
        // Packaging options with explicit file paths instead of wildcards
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
                // List all known conflict files explicitly
                "META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version",
                "META-INF/androidx.customview_customview.version",
                "META-INF/androidx.core_core.version",
                "META-INF/androidx.versionedparcelable_versionedparcelable.version",
                "META-INF/androidx.activity_activity.version",
                "META-INF/androidx.appcompat_appcompat.version",
                "META-INF/androidx.arch.core_core-runtime.version",
                "META-INF/androidx.asynclayoutinflater_asynclayoutinflater.version",
                "META-INF/androidx.coordinatorlayout_coordinatorlayout.version",
                "META-INF/androidx.core_core-ktx.version",
                "META-INF/androidx.cursoradapter_cursoradapter.version",
                "META-INF/androidx.documentfile_documentfile.version",
                "META-INF/androidx.drawerlayout_drawerlayout.version",
                "META-INF/androidx.fragment_fragment.version",
                "META-INF/androidx.interpolator_interpolator.version",
                "META-INF/androidx.legacy_legacy-support-core-ui.version",
                "META-INF/androidx.legacy_legacy-support-core-utils.version",
                "META-INF/androidx.lifecycle_lifecycle-common.version",
                "META-INF/androidx.lifecycle_lifecycle-livedata-core.version",
                "META-INF/androidx.lifecycle_lifecycle-livedata.version",
                "META-INF/androidx.lifecycle_lifecycle-runtime.version",
                "META-INF/androidx.lifecycle_lifecycle-viewmodel.version",
                "META-INF/androidx.loader_loader.version",
                "META-INF/androidx.print_print.version",
                "META-INF/androidx.slidingpanelayout_slidingpanelayout.version",
                "META-INF/androidx.swiperefreshlayout_swiperefreshlayout.version",
                "META-INF/androidx.vectordrawable_vectordrawable-animated.version",
                "META-INF/androidx.vectordrawable_vectordrawable.version",
                "META-INF/androidx.viewpager_viewpager.version"
            ]
        }
    }
`;
        
        // Insert the packaging options
        const newContents = 
          config.modResults.contents.substring(0, openingBraceIndex) + 
          packagingOptions + 
          config.modResults.contents.substring(openingBraceIndex);
        
        config.modResults.contents = newContents;
        console.log('Added packaging options to build.gradle');
      } else {
        console.warn('Could not find android { in build.gradle');
      }
    }
    
    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(
  withComprehensiveAndroidFixes,
  'withComprehensiveAndroidFixes',
  '1.0.0'
); 