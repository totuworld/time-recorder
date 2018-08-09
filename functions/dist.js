const shelljs =  require("shelljs");
const fs = require("fs");
const luxon = require("luxon");

// AWS에서 충돌이 나지 않도록 Version label을 하나 올려준다.
const packageLib = JSON.parse(fs.readFileSync("./package.json").toString());
const postFix = `${luxon.DateTime.local().toFormat("yyyyLLddHHmm")}-${packageLib.version}`;

shelljs.exec("npm shrinkwrap --production");
shelljs.rm("-rf", "./dist");
shelljs.mkdir("-p", "./dist");
shelljs.cp("./package.json", "./dist/package.json");
shelljs.cp("./.env", "./dist/.env");
shelljs.mv("./npm-shrinkwrap.json", "./dist/npm-shrinkwrap.json");
shelljs.cp("-R", "./lib/", "./dist/lib");
shelljs.cp("-R", "./.ebextensions/", "./dist/.ebextensions");
shelljs.cd("./dist");
shelljs.exec(`zip -r trserver-${postFix}.zip .`);
shelljs.exec("ls -al *.zip");
