/* MyTube Storage Manager
   Version 1.0
   Safe monitoring: does not delete or migrate existing videos.
*/

(() => {
  "use strict";

  const elements = {
    used: document.getElementById("sm-used"),
    quota: document.getElementById("sm-quota"),
    available: document.getElementById("sm-available"),
    indexedDB: document.getElementById("sm-indexeddb"),
    cache: document.getElementById("sm-cache"),
    persistence: document.getElementById("sm-persistence"),
    message: document.getElementById("sm-message"),
    refresh: document.getElementById("sm-refresh"),
    persist: document.getElementById("sm-persist")
  };

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
    if (bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }

    return `${size.toFixed(2)} ${units[unit]}`;
  }

  function showMessage(message, isError = false) {
    if (!elements.message) return;
    elements.message.textContent = message;
    elements.message.classList.toggle("sm-error", isError);
  }

  async function refreshStorage() {
    if (!navigator.storage || !navigator.storage.estimate) {
      showMessage(
        "Storage estimates are not supported by this browser.",
        true
      );
      return;
    }

    if (elements.refresh) {
      elements.refresh.disabled = true;
      elements.refresh.textContent = "Checking...";
    }

    try {
      const estimate = await navigator.storage.estimate();

      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      const available = Math.max(0, quota - usage);

      elements.used.textContent = formatBytes(usage);
      elements.quota.textContent = formatBytes(quota);
      elements.available.textContent = formatBytes(available);

      // Some browsers provide a breakdown of storage usage.
      const details = estimate.usageDetails || {};

      elements.indexedDB.textContent =
        typeof details.indexedDB === "number"
          ? formatBytes(details.indexedDB)
          : "Not separately reported";

      elements.cache.textContent =
        typeof details.caches === "number"
          ? formatBytes(details.caches)
          : "Not separately reported";

      showMessage(
        "Storage estimate updated. These figures are browser estimates, not guaranteed free space."
      );

      await refreshPersistenceStatus();

    } catch (error) {
      console.error("MyTube storage estimate failed:", error);
      showMessage("Could not read storage information.", true);
    } finally {
      if (elements.refresh) {
        elements.refresh.disabled = false;
        elements.refresh.textContent = "Refresh storage";
      }
    }
  }

  async function refreshPersistenceStatus() {
    if (!elements.persistence) return;

    if (!navigator.storage || !navigator.storage.persisted) {
      elements.persistence.textContent = "Status unavailable";
      return;
    }

    try {
      const isPersistent = await navigator.storage.persisted();

      elements.persistence.textContent = isPersistent
        ? "Persistent storage granted"
        : "Not currently persistent";
    } catch {
      elements.persistence.textContent = "Status unavailable";
    }
  }

  async function requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) {
      showMessage(
        "This browser does not support storage persistence requests.",
        true
      );
      return;
    }

    if (elements.persist) {
      elements.persist.disabled = true;
      elements.persist.textContent = "Requesting...";
    }

    try {
      const granted = await navigator.storage.persist();

      if (granted) {
        showMessage("The browser granted persistent storage.");
      } else {
        showMessage(
          "The browser did not grant persistent storage. Your videos remain in the existing library, but keep backups."
        );
      }

      await refreshPersistenceStatus();

    } catch (error) {
      console.error("Persistence request failed:", error);
      showMessage("Could not request persistent storage.", true);
    } finally {
      if (elements.persist) {
        elements.persist.disabled = false;
        elements.persist.textContent = "Request storage protection";
      }
    }
  }

  if (elements.refresh) {
    elements.refresh.addEventListener("click", refreshStorage);
  }

  if (elements.persist) {
    elements.persist.addEventListener("click", requestPersistence);
  }

  // Run once when the page loads.
  refreshStorage();

})();
