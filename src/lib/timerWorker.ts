// Timer Web Worker with high-precision timing
let timerId: number | null = null;
let startTime: number | null = null;
let isRunning = false;
let lastTick: number | null = null;
let baseTime: number = 0;
let lastKnownElapsed: number = 0;

// Use performance.now() for high-precision timing
const getHighResTime = () => self.performance.now();
const getCurrentTime = () => Date.now();

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START':
      if (!isRunning) {
        const now = getCurrentTime();
        startTime = payload.startTime || now;
        baseTime = now - startTime;
        lastTick = getHighResTime();
        lastKnownElapsed = 0;
        isRunning = true;
        tick();
      }
      break;

    case 'PAUSE':
      if (isRunning && startTime) {
        isRunning = false;
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        // Store the exact elapsed time when pausing
        lastKnownElapsed = getCurrentTime() - startTime;
        baseTime = lastKnownElapsed;
        lastTick = null;
      }
      break;

    case 'RESUME':
      if (!isRunning) {
        const now = getCurrentTime();
        // Resume from the last known elapsed time
        startTime = now - baseTime;
        lastTick = getHighResTime();
        isRunning = true;
        tick();
      }
      break;

    case 'STOP':
      isRunning = false;
      startTime = null;
      lastTick = null;
      baseTime = 0;
      lastKnownElapsed = 0;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      break;

    case 'SYNC':
      if (isRunning && startTime) {
        const now = getCurrentTime();
        // Recalculate based on stored base time
        const elapsed = now - startTime;
        // Only update if the new elapsed time is greater
        if (elapsed > lastKnownElapsed) {
          lastKnownElapsed = elapsed;
        }
        lastTick = getHighResTime();
        self.postMessage({ type: 'TICK', elapsed: lastKnownElapsed });
      }
      break;
  }
};

function tick() {
  if (!isRunning || !startTime) return;

  if (timerId) clearInterval(timerId);

  function sendTick() {
    if (!isRunning || !startTime) return;

    const now = getCurrentTime();
    const elapsed = now - startTime;
    
    // Ensure elapsed time never goes backwards
    if (elapsed > lastKnownElapsed) {
      lastKnownElapsed = elapsed;
      self.postMessage({ type: 'TICK', elapsed });
    } else {
      self.postMessage({ type: 'TICK', elapsed: lastKnownElapsed });
    }
    
    lastTick = getHighResTime();
  }

  // Immediate first tick
  sendTick();

  // Use a more precise interval with backup checks
  timerId = self.setInterval(() => {
    // Check if we missed any ticks
    const now = getHighResTime();
    if (lastTick && now - lastTick > 1500) {
      // We missed some ticks, sync the time
      self.postMessage({ type: 'SYNC_REQUEST' });
    }
    sendTick();
  }, 1000);
}