#!/usr/bin/env node

const meow = require("meow");
const { Maybe } = require("ramda-fantasy");
const jsxhtml = require("../lib/index.js");

const cli = meow(`
  Usage
    $ jsxhtml
  Options
    --desination        Directory where the HTML will be built to (defaults to './build')
    --components        Directory where the components live (defaults to './components')
    --extension         File extension for JSX templates (defaulst to '.jsx')
    --pages             Directory where the pages live (defaults to './pages')
`);

const config = jsxhtml.createConfig(
  Maybe.toMaybe(cli.flags.desination).getOrElse("./build"),
  Maybe.toMaybe(cli.flags.components).getOrElse("./components"),
  Maybe.toMaybe(cli.flags.extension).getOrElse(".jsx"),
  Maybe.toMaybe(cli.flags.pages).getOrElse("./pages")
);

jsxhtml.generate(config);
