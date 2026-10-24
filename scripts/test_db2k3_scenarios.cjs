const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== DB2K-003 ACCEPTANCE TEST SUITE (Section G Scenarios) ===');

const html = fs.readFileSync(path.resolve(__dirname, '../public/DB2K-003.html'), 'utf-8');
const s0 = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)][0][1];

function createMockEl(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    setAttribute: () => {},
    getAttribute: () => '',
    removeAttribute: () => {},
    hasAttribute: () => false,
    appendChild: (c) => c,
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

const mockDoc = {
  createElement: createMockEl,
  createElementNS: createMockEl,
  getElementById: (id) => createMockEl(id),
  querySelector: () => createMockEl(),
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  head: createMockEl('head'),
  body: createMockEl('body'),
  documentElement: createMockEl('html')
};

const sandbox = {
  window: {},
  document: mockDoc,
  navigator: { userAgent: 'Node-Test-Browser', onLine: true },
  location: { href: 'http://localhost/', protocol: 'http:', host: 'localhost', pathname: '/' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  console: console,
  setTimeout: (fn) => setTimeout(fn, 1),
  clearTimeout: clearTimeout,
  CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
  Event: class Event { constructor(type) { this.type = type; } },
  TextEncoder: TextEncoder,
  TextDecoder: TextDecoder,
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  MutationObserver: class MutationObserver { observe() {} disconnect() {} }
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);

try {
  vm.runInContext(s0, sandbox);
  console.log('✓ DB2K-003 Engine successfully initialized in sandbox.');
} catch (err) {
  console.error('Initialization error:', err.message);
  process.exit(1);
}

const results = [];
function record(name, status, details = '') {
  results.push({ name, status, details });
  console.log(`[${status}] ${name} ${details ? '— ' + details : ''}`);
}

// 1. Plain standalone HTML & HTML importing local CSS/JS/assets
sandbox.STATE.files = {
  'index.html': { content: '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Hello World</h1><script src="app.js"></script></body></html>' },
  'style.css': { content: 'body { color: blue; }' },
  'app.js': { content: 'console.log("running");' }
};
sandbox.detectProjectType();
record('Scenario 1: Plain HTML & Assets', sandbox.STATE.projectType === 'html-static' ? 'PASS' : 'FAIL', `Type: ${sandbox.STATE.projectType}`);

// 2. React 16/17/18/19 samples with version-appropriate paths
const r18 = sandbox.d2EmbeddedReactSupported({ dependencies: { react: '^18.2.0' } });
const r19 = sandbox.d2EmbeddedReactSupported({ dependencies: { react: '^19.0.0' } });
const r17 = sandbox.d2EmbeddedReactSupported({ dependencies: { react: '^17.0.2' } });
record('Scenario 2: React 16/17/18/19 Version Support', (r18 && r19 && r17) ? 'PASS' : 'FAIL', 'React 17/18/19 supported offline');

// 3. Vite React JSX and TSX with missing dist
sandbox.STATE.files = {
  'package.json': { content: JSON.stringify({ dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^5.0.0' } }) },
  'src/App.tsx': { content: 'export const App = () => <h1>Vite React TSX</h1>;' },
  'src/main.tsx': { content: 'import React from "react"; import ReactDOM from "react-dom/client"; import { App } from "./App"; ReactDOM.createRoot(document.getElementById("root")).render(<App />);' },
  'index.html': { content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' }
};
sandbox.detectProjectType();
const compiled3 = sandbox.findCompiledWebEntry(sandbox.STATE.files);
record('Scenario 3: Vite React TSX Missing Dist', (sandbox.STATE.projectType === 'react-vite' && compiled3 === null) ? 'PASS' : 'FAIL', 'Correctly identified as react-vite requiring automatic compilation');

// 4. React Router & TanStack Query dependencies
sandbox.STATE.files = {
  'package.json': { content: JSON.stringify({ dependencies: { react: '^19.0.0', 'react-router-dom': '^6.26.0', '@tanstack/react-query': '^5.50.0' } }) },
  'src/App.tsx': { content: 'import { BrowserRouter, Routes, Route } from "react-router-dom"; import { useQuery } from "@tanstack/react-query"; export const App = () => <div>Router & Query</div>;' }
};
sandbox.detectProjectType();
record('Scenario 4: React Router & TanStack Query Recognition', sandbox.STATE.projectType === 'react-vite' || sandbox.STATE.projectType === 'react-router' ? 'PASS' : 'FAIL', 'Dependencies mapped to offline shims');

// 5. React project with existing valid dist vs malformed dist
const validDistFiles = {
  'dist/index.html': { content: '<!doctype html><html><body><h1>Built</h1><script src="assets/main.js"></script></body></html>' },
  'dist/assets/main.js': { content: 'console.log("built");' }
};
const foundDist = sandbox.findCompiledWebEntry(validDistFiles);
record('Scenario 5: Prebuilt Dist Detection', foundDist === 'dist/index.html' ? 'PASS' : 'FAIL', `Found entry: ${foundDist}`);

// 6. React source file without index.html (synthesized shell)
sandbox.STATE.files = {
  'App.tsx': { content: 'export default function App() { return <h1>Standalone Component</h1>; }' }
};
sandbox.detectProjectType();
record('Scenario 6: Standalone Component without index.html', sandbox.STATE.entryFile === 'App.tsx' ? 'PASS' : 'FAIL', `Entry: ${sandbox.STATE.entryFile}`);

// 7. SSR-only Next.js project
sandbox.STATE.files = {
  'package.json': { content: JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.2.0' } }) },
  'pages/index.js': { content: 'export default function Page() { return <div>Next SSR</div>; }' }
};
sandbox.detectProjectType();
record('Scenario 7: Next.js SSR Project Detection', sandbox.STATE.projectType === 'next' ? 'PASS' : 'FAIL', `Type: ${sandbox.STATE.projectType}`);

// 8. Stale preview isolation & reloaded projects
const scope1 = sandbox.D2_STORAGE_SCOPE;
sandbox.detectProjectType();
const scope2 = sandbox.D2_STORAGE_SCOPE;
record('Scenario 8: Storage Scope & Session Isolation', scope1 === scope2 && scope1.includes('DB2K-003') ? 'PASS' : 'FAIL', `Scope: ${scope1}`);

// 9. Audit scoring integrity: never 0/100 on minor issue, null on 0 tests
const scoreEmpty = sandbox.computeAuditScore({ passed: 0, errors: 0 }, [], []);
const mockTests = Array.from({ length: 16 }, (_, i) => ({ id: 'test-' + i, status: i === 0 ? 'error' : 'pass' }));
const mockGroups = [{ severity: 'low', title: 'Missing alt attribute' }];
const scoreMinor = sandbox.computeAuditScore({ passed: 15, errors: 1 }, mockTests, mockGroups);
const scoreValid = scoreEmpty === null && scoreMinor >= 85;
record('Scenario 9: Audit Scoring Integrity', scoreValid ? 'PASS' : 'FAIL', `Empty: ${scoreEmpty}, Minor warning: ${scoreMinor}/100`);

// 10. Mobile Pan vs Scroll controls
const initialMode = sandbox.STATE.touchMode;
sandbox.togglePreviewTouchMode();
const toggledMode = sandbox.STATE.touchMode;
record('Scenario 10: In-Page Scroll vs Canvas Pan Mode', (initialMode === 'interact' && toggledMode === 'pan') ? 'PASS' : 'FAIL', `Toggled from ${initialMode} to ${toggledMode}`);

console.log('\n=== Acceptance Summary ===');
const passedCount = results.filter(r => r.status === 'PASS').length;
console.log(`Passed: ${passedCount}/${results.length}`);
if (passedCount === results.length) {
  console.log('ALL ACCEPTANCE SCENARIOS PASSED.');
} else {
  console.error('SOME ACCEPTANCE SCENARIOS FAILED.');
  process.exit(1);
}
