/* eslint import/no-unresolved: off, import/no-self-import: off */
// require('../.erb/scripts/node_modules/@babel/register');
require('@babel/register');
// See https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/2692#issuecomment-752836975

module.exports = require('./webpack.config.renderer.dev.babel').default;
