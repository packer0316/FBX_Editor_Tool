import '@testing-library/jest-dom'

// -----------------------------------------------------------------------------
// jsdom polyfills
// -----------------------------------------------------------------------------

// ResizeObserver (Director timeline 會用到)
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_cb: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserver;
}

// Canvas APIs（jsdom 預設不實作 getContext/toDataURL）
if (typeof HTMLCanvasElement !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto: any = HTMLCanvasElement.prototype;
  if (typeof proto.getContext !== 'function') {
    proto.getContext = () => null;
  }
  if (typeof proto.toDataURL !== 'function') {
    proto.toDataURL = () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  }
}

