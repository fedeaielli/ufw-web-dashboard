import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Window } from "happy-dom"

/**
 * Renders the real production bundle with a DOM shim. Catches runtime errors
 * that TypeScript and the API test suite cannot see, such as a missing
 * React context provider.
 */
test("production bundle mounts the dashboard without runtime errors", async () => {
  const view = new Window({ url: "http://localhost/" })
  view.document.body.innerHTML = '<div id="root"></div>'

  Object.defineProperty(globalThis, "window", { value: view, configurable: true, writable: true })
  Object.defineProperty(globalThis, "document", { value: view.document, configurable: true, writable: true })
  Object.defineProperty(globalThis, "navigator", { value: view.navigator, configurable: true, writable: true })
  Object.defineProperty(globalThis, "location", { value: view.location, configurable: true, writable: true })

  for (const key of Object.getOwnPropertyNames(view)) {
    if (key in globalThis) continue
    try {
      const value = view[key]
      if (typeof value === "function" || (value && typeof value === "object")) {
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
      }
    } catch {
      // Skip getters that need a fully booted window.
    }
  }

  // Node exposes a broken localStorage global unless --localstorage-file is set.
  Object.defineProperty(globalThis, "localStorage", { value: view.localStorage, configurable: true, writable: true })
  Object.defineProperty(globalThis, "sessionStorage", { value: view.sessionStorage, configurable: true, writable: true })

  for (const [key, value] of [
    ["getComputedStyle", view.getComputedStyle.bind(view)],
    ["matchMedia", () => ({
      matches: true, media: "(prefers-reduced-motion: reduce)",
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      onchange: null, dispatchEvent: () => false,
    })],
    ["requestAnimationFrame", (callback) => setTimeout(() => callback(Date.now()), 0)],
    ["cancelAnimationFrame", clearTimeout],
    ["ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }],
  ]) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }

  // happy-dom's Web Animations implementation rejects on cancel; Motion cancels
  // on unmount. A no-op keeps the smoke test free of async noise.
  for (const proto of [view.Element.prototype, view.SVGElement.prototype]) {
    proto.animate = () => ({
      cancel() {}, finish() {}, play() {}, pause() {}, reverse() {},
      finished: Promise.resolve(), playState: "finished", currentTime: 0,
      startTime: 0, effect: null, onfinish: null, oncancel: null,
      addEventListener() {}, removeEventListener() {},
    })
  }

  globalThis.fetch = async (url) => {
    const path = String(url)
    let body
    if (path.includes("/api/rules")) body = { status: "active", rules: [] }
    else if (path.includes("/api/logs")) body = {
      byPort: {}, byProto: {}, byIp: {}, ipPorts: {}, recent: [], series: [],
      total: 0, maxLines: 10000, defaultLines: 1000,
    }
    else body = { ip: "127.0.0.1" }
    return { status: 200, ok: true, json: async () => body }
  }

  const html = await readFile(resolve("dist/index.html"), "utf8")
  const bundle = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
  assert.ok(bundle, "built index.html references a JS bundle")

  await import(pathToFileURL(resolve("dist", `.${bundle}`)).href)

  await new Promise((done) => setTimeout(done, 100))

  const root = view.document.getElementById("root")
  assert.ok(root, "#root exists")
  assert.ok(root.innerHTML.length > 0, "React mounted content into #root")
  assert.match(root.textContent || "", /Overview|Firewall/, "dashboard shell rendered")
})
