const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- DB2K-002 VERIFICATION SUITE ---');

const html = fs.readFileSync(path.resolve(__dirname, '../public/DB2K-002.html'), 'utf-8');
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
  window: {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
  },
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
  console.log('✓ Script 0 initialized in sandbox successfully.');
} catch (err) {
  console.error('Sandbox init error:', err.message, err.stack);
}

// 1. Check project type detection
console.log('\n[TEST 1] Project Type Detection:');
const testCases = [
  {
    name: 'Source-only Vite React project',
    files: {
      'package.json': { content: JSON.stringify({ dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^5.0.0' } }) },
      'src/App.tsx': { content: 'export const App = () => <h1>Hello React</h1>;' },
      'src/main.tsx': { content: 'import React from "react"; import ReactDOM from "react-dom/client"; import { App } from "./App"; ReactDOM.createRoot(document.getElementById("root")).render(<App />);' },
      'index.html': { content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' }
    },
    expectedType: 'react-vite'
  },
  {
    name: 'Prebuilt project with dist',
    files: {
      'dist/index.html': { content: '<!doctype html><html><body><h1>Prebuilt App</h1><script src="bundle.js"></script></body></html>' },
      'dist/bundle.js': { content: 'console.log("built");' }
    },
    checkFn: (res) => res.compiledEntry === 'dist/index.html'
  },
  {
    name: 'Plain HTML site',
    files: {
      'index.html': { content: '<!doctype html><html><body><h1>Plain HTML</h1></body></html>' }
    },
    expectedType: 'single-html'
  }
];

testCases.forEach((tc, i) => {
  sandbox.STATE.files = tc.files;
  if (sandbox.detectProjectType) {
    sandbox.detectProjectType();
    const type = sandbox.STATE.projectType;
    const compiled = sandbox.findCompiledWebEntry ? sandbox.findCompiledWebEntry(tc.files) : null;
    console.log(`  Test 1.${i+1} ${tc.name}: Detected type = "${type}", Compiled entry = ${compiled}`);
    if (tc.expectedType) {
      if (type === tc.expectedType) console.log('    -> PASS');
      else console.log(`    -> FAIL (expected ${tc.expectedType}, got ${type})`);
    } else if (tc.checkFn) {
      if (tc.checkFn({ compiledEntry: compiled })) console.log('    -> PASS');
      else console.log('    -> FAIL');
    }
  }
});

// 2. Check Audit scoring with formula
console.log('\n[TEST 2] Audit Scoring Integrity:');
if (sandbox.computeAuditScore) {
  // Scenario A: 0 ran tests -> must return null
  const scoreEmpty = sandbox.computeAuditScore({ passed: 0, errors: 0 }, [], []);
  console.log('  Scenario A (0 tests ran): Score =', scoreEmpty, scoreEmpty === null ? '-> PASS (Not scored)' : '-> FAIL');

  // Scenario B: 15 passed, 1 minor warning -> must NOT be 0/100
  const mockTests = Array.from({ length: 16 }, (_, i) => ({ id: 'test-' + i, status: i === 0 ? 'error' : 'pass' }));
  const mockGroups = [{ severity: 'low', title: 'Missing img alt attribute' }];
  const scoreMinor = sandbox.computeAuditScore({ passed: 15, errors: 1 }, mockTests, mockGroups);
  console.log('  Scenario B (15 passed, 1 minor warning): Score =', scoreMinor, scoreMinor >= 85 ? `-> PASS (${scoreMinor}/100)` : `-> FAIL (Too low: ${scoreMinor}/100)`);

  // Scenario C: Severe syntax errors (2 passed, 6 high severity errors)
  const mockFailTests = Array.from({ length: 8 }, (_, i) => ({ id: 'fail-test-' + i, status: i < 2 ? 'pass' : 'error' }));
  const mockFailGroups = [
    { severity: 'high', title: 'JS syntax fatal error' },
    { severity: 'high', title: 'Missing critical module' }
  ];
  const scoreFail = sandbox.computeAuditScore({ passed: 2, errors: 6 }, mockFailTests, mockFailGroups);
  console.log('  Scenario C (2 passed, 6 fatal errors): Score =', scoreFail, scoreFail <= 30 ? `-> PASS (${scoreFail}/100)` : `-> FAIL (${scoreFail}/100)`);
}

// 3. Check React 19 and 18 support flags
console.log('\n[TEST 3] React Version Detection & Compatibility:');
if (sandbox.d2EmbeddedReactSupported) {
  const r18Supported = sandbox.d2EmbeddedReactSupported({ dependencies: { react: '^18.2.0' } });
  const r19Supported = sandbox.d2EmbeddedReactSupported({ dependencies: { react: '^19.0.0' } });
  console.log('  React 18 supported offline:', r18Supported ? '-> PASS' : '-> FAIL');
  console.log('  React 19 supported offline:', r19Supported ? '-> PASS' : '-> FAIL');
}

// 4. Check Mobile Pan vs Scroll controls
console.log('\n[TEST 4] Mobile Gestures and Pan/Scroll Mode:');
console.log('  Initial touchMode:', sandbox.STATE?.touchMode);
if (sandbox.togglePreviewTouchMode) {
  sandbox.togglePreviewTouchMode();
  console.log('  Toggled touchMode:', sandbox.STATE?.touchMode);
  console.log('  Touch mode toggling:', sandbox.STATE?.touchMode === 'pan' ? '-> PASS' : '-> FAIL');
}

console.log('\n--- VERIFICATION COMPLETE ---');
