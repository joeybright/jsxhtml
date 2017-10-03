const babel = require("babel-core");
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const fse = require("fs-extra");
const klaw = require("klaw-sync");
const R = require("ramda");
const { Either } = require("ramda-fantasy");
const { h } = require("hyperapp");
const { toString } = require("hyperapp-server");

const destinationDirLens = R.lensPath(["config", "desinationDir"]);
const componentsDirLens = R.lensPath(["config", "componentsDir"]);
const extensionLens = R.lensPath(["config", "extension"]);
const pagesDirLens = R.lensPath(["config", "pagesDir"]);
const pagesInputsLens = R.lensPath(["inputs", "pages"]);
const componentsInputsLens = R.lensPath(["inputs", "components"]);
const pagesOutputsLens = R.lensPath(["outputs", "pages"]);
const componentsOutputsLens = R.lensPath(["outputs", "components"]);

const createConfig = (d, c, e, p) => ({
  config: {
    destinationDir: d,
    componentsDir: c,
    extension: e,
    pagesDir: p
  }
});

const emptyOrCreateDir = obj => {
  const dir = obj.config.destinationDir;
  fs.existsSync(dir) ? fse.emptydirSync(dir) : fs.mkdirSync(dir);
  return Either.of(obj);
};

const getFilesInDir = (pathParam, lens) => obj =>
  fs.existsSync(R.view(lens, obj))
    ? Either.Right(
        R.assocPath(
          pathParam,
          klaw(R.view(lens, obj), {
            nodir: true,
            filter: f => path.extname(f.path) === R.view(extensionLens, obj)
          }),
          obj
        )
      )
    : Either.Left("There is no " + R.view(lens, obj) + " directory!");

const changeFiles = (lens, obj, func) =>
  R.set(lens, R.map(func, R.view(lens, obj)), obj);

const getFileContents = lens => obj =>
  changeFiles(lens, obj, f =>
    R.assoc("contents", fs.readFileSync(f.path, "utf8"), f)
  );

const getFilePathInfo = lens => obj =>
  changeFiles(lens, obj, f => R.assoc("parsedPath", path.parse(f.path), f));

const wrapComponent = (name, contents) =>
  "const " + name + " = (state, children) => " + contents;

const wrapPage = (name, contents) => "const " + name + " = " + contents;

const wrapFileContents = (forComponent, lens) => obj =>
  changeFiles(lens, obj, f =>
    R.assoc(
      "wrappedContents",
      forComponent
        ? wrapComponent(f.parsedPath.name, f.contents)
        : wrapPage(f.parsedPath.name, f.contents),
      f
    )
  );

const wrapComponents = (pathParam, lens) => obj =>
  R.assocPath(
    pathParam,
    R.reduce(
      (itt, obj) => itt + obj.wrappedContents + "\n",
      "",
      R.view(lens, obj)
    ),
    obj
  );

const outputPages = (pathParam, pagesLens, componentsLens) => obj =>
  R.assocPath(
    pathParam,
    R.map(
      f => ({
        contents:
          R.view(componentsLens, obj) +
          f.wrappedContents +
          "\nhtml = toString(" +
          f.parsedPath.name +
          ")",
        path:
          f.parsedPath.dir.replace(
            obj.config.pagesDir.split("/")[1],
            obj.config.destinationDir.split("/")[1]
          ) +
          "/" +
          f.parsedPath.name +
          ".html"
      }),
      R.view(pagesLens, obj)
    ),
    obj
  );

const renderPages = lens => obj =>
  changeFiles(lens, obj, f => {
    const obj = {
      h: h,
      toString: toString,
      html: null
    };
    const transformed = babel.transform(f.contents, {
      presets: ["hyperapp"]
    });
    const script = new vm.Script(transformed.code);
    const ctx = new vm.createContext(obj);
    script.runInContext(ctx);
    return R.assoc("html", ctx.html, f);
  });

const savePages = lens => obj => {
  R.map(f => {
    fse.outputFileSync(f.path, f.html);
    return f;
  }, R.view(lens, obj));
  return obj;
};

const generate = R.compose(
  R.map(savePages(pagesOutputsLens)),
  R.map(renderPages(pagesOutputsLens)),
  R.map(
    outputPages(["outputs", "pages"], pagesInputsLens, componentsOutputsLens)
  ),
  R.map(wrapComponents(["outputs", "components"], componentsInputsLens)),
  R.map(wrapFileContents(true, componentsInputsLens)),
  R.map(wrapFileContents(false, pagesInputsLens)),
  R.map(getFilePathInfo(componentsInputsLens)),
  R.map(getFilePathInfo(pagesInputsLens)),
  R.map(getFileContents(componentsInputsLens)),
  R.map(getFileContents(pagesInputsLens)),
  R.chain(getFilesInDir(["inputs", "components"], componentsDirLens)),
  R.chain(getFilesInDir(["inputs", "pages"], pagesDirLens)),
  emptyOrCreateDir
);

module.exports = {
  generate: generate,
  createConfig: createConfig
};
