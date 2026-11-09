class SaveStorageBusy extends Error {}
async function withStorageLock(name, run) {
  if (!navigator.locks) return await run();
  return navigator.locks.request(name, {ifAvailable: true}, lock => {
    if (!lock) throw new SaveStorageBusy();
    return run();
  });
}
const saveLockName = 'songs-of-syx-browser-saves-v3';
