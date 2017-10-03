const { generate, createConfig } = require("./lib");

const build = (desination, components, ext, pages) => {
  const config = createConfig(desination, components, ext, pages);
  return generate(config);
};

module.exports = build;
