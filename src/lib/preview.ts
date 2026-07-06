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
  {
    pkg: "d3",
    cdn: "https://unpkg.com/d3@7/dist/d3.min.js",
    global: "d3",
  },
  {
    pkg: "framer-motion",
    cdn: "https://unpkg.com/framer-motion@11/dist/framer-motion.js",
    global: "Motion",
  },
];

// Libraries that don't have a UMD build — we generate inline shims instead.
const SHIMMED_LIBRARIES: { pkg: string; global: string }[] = [
  { pkg: "lucide-react", global: "LucideReact" },
];

// A small set of real lucide icon paths (viewBox 0 0 24 24, stroke-based)
// for the most commonly used icons in generated artifacts. Unrecognized
// icon names fall back to a generic placeholder shape.
const LUCIDE_ICON_PATHS: Record<string, string> = {
  X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  ChevronDown: '<path d="m6 9 6 6 6-6"/>',
  ChevronUp: '<path d="m18 15-6-6-6 6"/>',
  ChevronLeft: '<path d="m15 18-6-6 6-6"/>',
  ChevronRight: '<path d="m9 18 6-6-6-6"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  Plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  Minus: '<path d="M5 12h14"/>',
  Trash2: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  Edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  User: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  Star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  ArrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  ArrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  Download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  Upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  Copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  ExternalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  Info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  AlertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  CheckCircle: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  XCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  Calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  Mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  Lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  EyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  Loader2: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
};

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

    // Handle: import * as name from 'pkg'
    const reNamespace = new RegExp(
      `import\\s*\\*\\s*as\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+from\\s*['"]${escaped}['"]\\s*;?`,
      "g"
    );
    code = code.replace(reNamespace, (_, name) => `const ${name} = ${globalName};`);
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
    window.__LUCIDE_ICON_PATHS__ = ${JSON.stringify(LUCIDE_ICON_PATHS)};
    window.LucideReact = new Proxy({}, {
      get: function(_, name) {
        if (typeof name !== 'string') return undefined;
        var inner = window.__LUCIDE_ICON_PATHS__[name] || '<circle cx="12" cy="12" r="10"/>';
        return function LucideIcon(props) {
          var size = props && props.size || 24;
          var color = props && props.color || 'currentColor';
          var sw = props && props.strokeWidth || 2;
          return React.createElement('svg', {
            width: size, height: size, viewBox: '0 0 24 24',
            fill: 'none', stroke: color, strokeWidth: sw,
            strokeLinecap: 'round', strokeLinejoin: 'round',
            className: props && props.className || '',
            dangerouslySetInnerHTML: { __html: inner }
          });
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
  <!--
    Pin Babel to the last 7.x release. The "latest" tag now resolves to
    @babel/standalone 8.x, whose @babel/preset-react defaults the JSX runtime
    to "automatic". Automatic-runtime output imports the jsx helpers from
    "react/jsx-runtime", which doesn't exist in this UMD/global setup, so every
    JSX artifact throws at runtime (surfaced as a cross-origin "Script error").
    Babel 7 defaults to the classic runtime (React.createElement), which is what
    this preview environment provides via the global React.
  -->
  <script src="https://unpkg.com/@babel/standalone@7.29.7/babel.min.js"></script>
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
  <script type="text/babel" data-presets="react,typescript">
${jsxCode}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(${componentName})
);
  </script>
</body>
</html>`;
}

// Escapes a string for safe embedding inside a `<script>` template literal.
function escapeForTemplateLiteral(source: string): string {
  return source
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    // Prevent the HTML parser from closing the enclosing <script> early on a
    // literal "</..." (e.g. "</script>") in the source. Escaping the slash as
    // "<\/" is invisible to JS (the string value is unchanged, so marked.parse
    // still sees the original text) but stops the tokenizer from breaking out.
    .replace(/<\//g, "<\\/");
}

// Escapes a string for safe embedding as HTML text content.
function escapeHtml(source: string): string {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildMarkdownHTML(title: string, source: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://unpkg.com/marked@12/marked.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; }
    #root { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1, h2, h3, h4 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    p, ul, ol { margin: 0.75em 0; }
    ul, ol { padding-left: 1.5em; }
    code { background: #f5f5f5; border-radius: 4px; padding: 0.15em 0.4em; font-size: 0.9em; font-family: ui-monospace, monospace; }
    pre { background: #f5f5f5; border-radius: 6px; padding: 1em; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #e5e5e5; margin: 1em 0; padding-left: 1em; color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e5e5e5; padding: 0.5em 0.75em; text-align: left; }
    a { color: #2563eb; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    document.getElementById("root").innerHTML = marked.parse(\`${escapeForTemplateLiteral(source)}\`);
  </script>
</body>
</html>`;
}

export function buildMermaidHTML(title: string, source: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://unpkg.com/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    #root { display: flex; justify-content: center; padding: 2rem 1rem; }
  </style>
</head>
<body>
  <div id="root">
    <pre class="mermaid">${escapeHtml(source)}</pre>
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>`;
}
