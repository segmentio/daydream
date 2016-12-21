import ExtractTextPlugin from 'extract-text-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'
import cssImports from 'postcss-import'
import cssnext from 'postcss-cssnext'
import path from 'path'

const base = {
  context: path.join(__dirname, 'src'),
  entry: {
    background: './background/index.js',
    'content-script': './content-scripts/index.js',
    popup: './popup/index.js'
  },
  output: {
    path: './build',
    publicPath: '/',
    filename: '[name].js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('style', 'css?sourceMap!postcss', { publicPath: '/' })
      }
    ]
  },
  postcss: webpack => [
    cssImports({ addDependencyTo: webpack }),
    cssnext({ browsers: 'last 2 versions' })
  ],
  plugins: [
    new CopyPlugin([
      { from: './popup/index.html', to: './popup.html' },
      { from: './manifest.json', to: './manifest.json' },
      { from: 'images', to: 'images' }
    ]),
    new ExtractTextPlugin('[name].css')
  ]
}

module.exports = base
