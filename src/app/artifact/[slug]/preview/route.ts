import { fetchArtifact, getStorageUrl } from "@/lib/supabase/artifacts";

// ─── JSX Processing ───────────────────────────────────────────────────────────

function processJSX(source: string): { code: string; componentName: string } {
  let code = source;

  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]react['"]\s*;?/g,
    (_, imports) => `const { ${imports.trim()} } = React;`
  );

  let componentName = "App";
  code = code.replace(
    /export\s+default\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, name) => {
      componentName = name;
      return `function ${name}`;
    }
  );

  code = code.replace(
    /export\s+default\s+([A-Za-z_][A-Za-z0-9_]*)\s*;?$/m,
    (_, name) => {
      componentName = name;
      return "";
    }
  );

  code = code.replace(/^import\s+.*$/gm, "");

  return { code, componentName };
}

function buildHTML(title: string, jsxCode: string, componentName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
${jsxCode}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(${componentName})
);
  </script>
</body>
</html>`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);

  if (!artifact) {
    return new Response("Artifact not found", { status: 404 });
  }

  const storageUrl = getStorageUrl(artifact.storage_path);
  const res = await fetch(storageUrl);
  if (!res.ok) {
    return new Response("Artifact file not found", { status: 502 });
  }

  const source = await res.text();
  const isJSX =
    artifact.storage_path.endsWith(".jsx") ||
    artifact.storage_path.endsWith(".js");

  if (!isJSX) {
    return new Response(source, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { code, componentName } = processJSX(source);
  const html = buildHTML(artifact.title, code, componentName);

  return new Response(html, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
