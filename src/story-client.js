(function () {
  // Serialize writes so simultaneous first saves receive the same private cookie.
  let pending = Promise.resolve();
  function save(story) {
    const next = pending.catch(() => {}).then(async () => {
      const response = await fetch('/api/stories', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(story),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`Your story could not be saved (${result.error || response.status}). Please retry.`);
      return result;
    });
    pending = next;
    return next;
  }
  window.FABLE_STORE = { save };
})();
