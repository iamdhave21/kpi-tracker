const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://abbss-ops-portal.vercel.app/', pretendToBeVisual: true })
const g = globalThis
for (const k of ['window', 'document', 'HTMLElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage', 'DOMParser', 'SVGElement', 'Element']) { try { g[k] = dom.window[k] } catch {} }
try { Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true }) } catch {}
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
g.IS_REACT_ACT_ENVIRONMENT = true
g.confirm = () => true; g.alert = () => {}; g.scrollTo = () => {}; dom.window.scrollTo = () => {}
require('./out.cjs')
