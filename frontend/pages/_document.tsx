import fs from "node:fs";
import path from "node:path";
import { Head, Html, Main, NextScript } from "next/document";

function getInlineCss() {
  const projectRoot = process.cwd();
  const publicCssPath = path.join(projectRoot, "frontend", "public", "app-static.css");

  if (!fs.existsSync(publicCssPath)) {
    return "";
  }

  return fs.readFileSync(publicCssPath, "utf8");
}

export default function Document() {
  const inlineCss = getInlineCss();

  return (
    <Html lang="en">
      <Head>
        {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
