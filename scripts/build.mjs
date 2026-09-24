import { rm, mkdir, cp } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const name of ["index.html", "styles.css", "script.js", "assets"]) {
  await cp(name, `dist/${name}`, { recursive: true });
}
console.log("Web lista en dist; las funciones se empaquetan por separado.");
