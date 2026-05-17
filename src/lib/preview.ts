// ─── Shared JSX → HTML pipeline used by both preview routes ──────────────────

// Libraries we can serve from CDN.
// key   = npm package name as it appears in import statements
// cdn   = UMD script URL
// global = window global the UMD build exposes
const CDN_LIBRARIES: { pkg: string; cdn: string; global: string }[] = [
  {
    pkg: "lucide-react",
    cdn: "https://unpkg.com/lucide-react/dist/umd/lucide-react.min.js",
    global: "LucideReact",
  },
  {
    pkg: "recharts",
    cdn: "https://unpkg.com/recharts/umd/Recharts.js",
    global: "Recharts",
  },
];

export function processJSX(source: string): { code: string; componentName: string } {
  let code = source;

  // Replace React named imports with destructuring from the global React object
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]react['"]\s*;?/g,
    (_, imports) => `const { ${imports.trim()} } = React;`
  );

  // Replace known library imports with destructuring from their CDN globals
  for (const { pkg, global } of CDN_LIBRARIES) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${escaped}['"]\\s*;?`,
      "g"
    );
    code = code.replace(re, (_, imports) => `const { ${imports.trim()} } = ${global};`);

    // Also handle default imports: import Foo from 'lucide-react'
    const reDefault = new RegExp(
      `import\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+from\\s*['"]${escaped}['"]\\s*;?`,
      "g"
    );
    code = code.replace(reDefault, (_, name) => `const ${name} = ${global};`);
  }

  // Capture and strip "export default function Name" → "function Name"
  let componentName = "App";
  code = code.replace(
    /export\s+default\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, name) => {
      componentName = name;
      return `function ${name}`;
    }
  );

  // Capture and strip standalone "export default Name;"
  code = code.replace(
    /export\s+default\s+([A-Za-z_][A-Za-z0-9_]*)\s*;?$/m,
    (_, name) => {
      componentName = name;
      return "";
    }
  );

  // Strip any remaining import statements
  code = code.replace(/^import\s+.*$/gm, "");

  return { code, componentName };
}

export function buildHTML(title: string, jsxCode: string, componentName: string): string {
  const cdnScripts = CDN_LIBRARIES.map(
    ({ cdn }) => `  <script src="${cdn}"></script>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
${cdnScripts}
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
    #error-overlay {
      display: none;
      position: fixed; inset: 0; z-index: 9999;
      background: #0f172a; color: #f8fafc;
      font-family: ui-monospace, monospace;
      padding: 2rem; overflow: auto;
    }
    #error-overlay h2 { color: #f87171; font-size: 1.1rem; margin-bottom: 0.75rem; }
    #error-overlay pre {
      background: #1e293b; border-radius: 6px;
      padding: 1rem; font-size: 0.8rem;
      white-space: pre-wrap; word-break: break-word;
      margin-bottom: 1rem;
    }
    #error-overlay p { font-size: 0.8rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-overlay">
    <h2>⚠ Render Error</h2>
    <pre id="error-message"></pre>
    <p>This error came from the artifact code. The file needs to be updated to fix it.</p>
  </div>
  <script>
    window.addEventListener('error', function(e) {
      var overlay = document.getElementById('error-overlay');
      var msg = document.getElementById('error-message');
      if (overlay && msg) {
        msg.textContent = e.error ? (e.error.stack || e.error.message) : e.message;
        overlay.style.display = 'block';
      }
    });
  </script>
  <script type="text/babel">
${jsxCode}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(${componentName})
);
  </script>
</body>
</html>`;
}
