// This app.config.js simply passes through any existing config
// The comprehensive plugin in eas.json will handle the modifications
module.exports = ({ config }) => {
  return config;
}; 