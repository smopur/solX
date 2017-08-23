var webpack = require('webpack');

module.exports = {
  devtool: 'inline-sourcemap',
  context: __dirname,
  entry: "./index.js",
  output: {
    path: "./js",
    publicPath: '/js',
    filename: "bundle.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
};