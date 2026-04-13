// React Compiler is enabled in app.json (experiments.reactCompiler). It still runs through Babel via babel-preset-expo; Metro cannot drop Babel entirely.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
