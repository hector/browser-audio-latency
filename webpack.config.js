const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  plugins: [
    // Generate a base html file and injects all generated css and js files
    new HtmlWebpackPlugin({
      template: "src/index.html",
    }),
  ],
};
