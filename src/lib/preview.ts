// ─── Shared JSX → HTML pipeline used by both preview routes ──────────────────

// Libraries we can serve from CDN.
// key   = npm package name as it appears in import statements
// cdn   = UMD script URL
// global = window global the UMD build exposes
const CDN_LIBRARIES: { pkg: string; cdn: string; global: string }[] = [
  {
    pkg: "recharts",
    cdn: "https://unpkg.com/react-is@18/umd/react-is.production.min.js",
    global: "__react_is_preload__",
  },
  {
    pkg: "recharts",
    cdn: "https://unpkg.com/recharts@2.5.0/umd/Recharts.js",
    global: "Recharts",
  },
];

// Libraries that don't have a UMD build — we generate inline shims instead.
const SHIMMED_LIBRARIES: { pkg: string; global: string }[] = [
  { pkg: "lucide-react", global: "LucideReact" },
];

export function processJSX(source: string): { code: string; componentName: string } {
  let code = source;

  // Handle: import React, { useState, ... } from 'react'
  code = code.replace(
    /import\s+React\s*,\s*\{([^}]+)\}\s*from\s*['"]react['"]\s*;?/g,
    (_, imports) => `const { ${imports.trim()} } = React;`
  );

  // Handle: import * as React from 'react'
  code = code.replace(
    /import\s+\*\s+as\s+React\s+from\s*['"]react['"]\s*;?/g,
    ""
  );

  // Handle: import React from 'react'
  code = code.replace(
    /import\s+React\s+from\s*['"]react['"]\s*;?/g,
    ""
  );

  // Handle: import { useState, ... } from 'react'
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]react['"]\s*;?/g,
    (_, imports) => `const { ${imports.trim()} } = React;`
  );

  // Replace known CDN library imports with destructuring from their globals
  const importableLibs = CDN_LIBRARIES.filter((lib) => !lib.global.startsWith("__"));
  for (const { pkg, global: globalName } of [...importableLibs, ...SHIMMED_LIBRARIES]) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${escaped}['"]\\s*;?`,
      "g"
    );
    code = code.replace(re, (_, imports) => `const { ${imports.trim()} } = ${globalName};`);

    const reDefault = new RegExp(
      `import\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+from\\s*['"]${escaped}['"]\\s*;?`,
      "g"
    );
    code = code.replace(reDefault, (_, name) => `const ${name} = ${globalName};`);
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

  const shimScripts = SHIMMED_LIBRARIES.map(({ global: globalName }) => {
    if (globalName === "LucideReact") {
      return `  <script>
    window.LucideReact = new Proxy({}, {
      get: function(_, name) {
        if (typeof name !== 'string') return undefined;
        return function LucideIcon(props) {
          var size = props && props.size || 24;
          var color = props && props.color || 'currentColor';
          var sw = props && props.strokeWidth || 2;
          return React.createElement('svg', {
            width: size, height: size, viewBox: '0 0 24 24',
            fill: 'none', stroke: color, strokeWidth: sw,
            strokeLinecap: 'round', strokeLinejoin: 'round',
            className: props && props.className || ''
          }, React.createElement('circle', { cx: 12, cy: 12, r: 10 }));
        };
      }
    });
  </script>`;
    }
    return "";
  }).filter(Boolean).join("\n");

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
${shimScripts}
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
