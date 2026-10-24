const resetTimers = new WeakMap();

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Local files and restricted browser contexts may need the fallback.
    }
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Copy command failed");
  } finally {
    field.remove();
  }
}

document.addEventListener("click", async event => {
  const button = event.target instanceof Element ? event.target.closest("[data-copy-code]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  const code = button.parentElement?.querySelector("pre > code");
  if (!code) return;

  try {
    await copyText(code.textContent ?? "");
    button.textContent = "Copied!";
    button.setAttribute("aria-label", "Code copied");
  } catch {
    button.textContent = "Copy failed";
    button.setAttribute("aria-label", "Could not copy code");
  }

  clearTimeout(resetTimers.get(button));
  resetTimers.set(button, setTimeout(() => {
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code");
  }, 2000));
});
