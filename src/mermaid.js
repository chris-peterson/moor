// BF-04: turn the inert data-mermaid placeholders renderMarkdown emits into
// diagram SVGs. This lives outside src/engine/ because mermaid needs a browser
// DOM — the engine's node test suite must not import it. mermaid runs here in
// the renderer; its output is static SVG markup that drops into the
// scripts-disabled preview iframe like any other rendered content.
import mermaid from 'mermaid';

let initialized = false;
let counter = 0;

function ensureInit() {
  if (initialized) return;
  // securityLevel 'strict' has mermaid sanitize diagram text, and startOnLoad
  // off keeps it from scanning the host document — we drive rendering by hand.
  mermaid.initialize({ startOnLoad: false, theme: 'dark', look: 'handDrawn', securityLevel: 'strict' });
  initialized = true;
}

export function hasMermaid(html) {
  return Boolean(html) && html.includes('data-mermaid');
}

// Replace each placeholder with its rendered diagram. A diagram that fails to
// parse surfaces the error text in place rather than vanishing (no silent
// fallback) so the reviewer sees which block is malformed.
export async function renderMermaid(html) {
  if (!hasMermaid(html)) return html;
  ensureInit();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(doc.querySelectorAll('[data-mermaid]'));
  for (const node of nodes) {
    const source = node.textContent;
    try {
      const { svg } = await mermaid.render(`moor-mermaid-${counter++}`, source);
      node.outerHTML = svg;
    } catch (err) {
      node.textContent = `mermaid: ${err?.message || 'failed to render diagram'}`;
    }
  }
  return doc.body.innerHTML;
}
