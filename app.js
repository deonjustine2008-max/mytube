const DB_NAME = "mytube-library";
const DB_VERSION = 1;
const STORE_NAME = "videos";

const picker = document.getElementById("video-picker");
const grid = document.getElementById("video-grid");
const search = document.getElementById("search");
const message = document.getElementById("message");
const count = document.getElementById("video-count");
const emptyState = document.getElementById("empty-state");
const storageInfo = document.getElementById("storage-info");
const networkStatus = document.getElementById("network-status");
const refreshStorageButton = document.getElementById("refresh-storage");

let db;
let objectUrls = [];

function createVideoId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id"
        });

        store.createIndex("name", "name", {
          unique: false
        });

        store.createIndex("addedAt", "addedAt", {
          unique: false
        });
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
      };

      resolve(database);
    };

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn("Database upgrade is blocked.");
    };
  });
}

function storeRequest(mode, action) {
  return new Promise((resolve, reject) => {
    let transaction;
    let request;

    try {
      transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      request = action(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      resolve(request ? request.result : undefined);
    };

    transaction.onerror = () => {
      reject(
        transaction.error ||
        request?.error ||
        new Error("Database transaction failed.")
      );
    };

    transaction.onabort = () => {
      reject(
        transaction.error ||
        request?.error ||
        new Error("Database transaction was cancelled.")
      );
    };
  });
}

function getAllVideos() {
  return storeRequest("readonly", store => store.getAll());
}

function saveVideo(record) {
  return storeRequest("readwrite", store => store.put(record));
}

function removeVideo(id) {
  return storeRequest("readwrite", store => store.delete(id));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#ff9da8" : "#aab7ff";
}

async function refreshStorage() {
  if (!navigator.storage?.estimate) {
    storageInfo.textContent =
      "Storage estimates are not available in this browser.";
    return;
  }

  try {
    const estimate = await navigator.storage.estimate();

    const used = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;

    storageInfo.textContent = quota
      ? `${formatBytes(used)} used of approximately ${formatBytes(quota)} available to this browser`
      : `${formatBytes(used)} used`;

  } catch (error) {
    console.error("Storage estimate failed:", error);

    storageInfo.textContent =
      "Could not read storage information.";
  }
}

async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    try {
      const granted = await navigator.storage.persist();

      if (!granted) {
        setMessage(
          "Browser storage may still be cleared by device or browser storage management."
        );
      }

    } catch (error) {
      console.warn("Persistent storage request failed:", error);
    }
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function clearObjectUrls() {
  for (const url of objectUrls) {
    URL.revokeObjectURL(url);
  }

  objectUrls = [];
}

async function renderLibrary() {
  clearObjectUrls();

  const allVideos = await getAllVideos();

  const query = search.value.trim().toLocaleLowerCase();

  const videos = allVideos
    .filter(video =>
      video.name.toLocaleLowerCase().includes(query)
    )
    .sort((a, b) => b.addedAt - a.addedAt);

  grid.replaceChildren();

  count.textContent =
    `${videos.length} ${videos.length === 1 ? "video" : "videos"}`;

  emptyState.hidden = allVideos.length !== 0;

  if (allVideos.length > 0 && videos.length === 0) {
    const noResults = makeElement(
      "p",
      "message",
      "No videos match your search."
    );

    grid.append(noResults);
  }

  for (const record of videos) {
    const card = makeElement("article", "video-card");

    const player = makeElement("video");

    player.controls = true;
    player.preload = "metadata";
    player.playsInline = true;

    player.setAttribute(
      "aria-label",
      `Play ${record.name}`
    );

    const url = URL.createObjectURL(record.file);

    objectUrls.push(url);
    player.src = url;

    const details = makeElement("div", "video-details");

    details.append(
      makeElement("h3", "video-title", record.name)
    );

    const meta = makeElement("div", "video-meta");

    meta.append(
      makeElement("span", "", formatBytes(record.size)),
      makeElement(
        "span",
        "",
        new Date(record.addedAt).toLocaleDateString()
      )
    );

    const actions = makeElement("div", "card-actions");

    actions.append(
      makeElement("span", "video-meta", "Stored on this device")
    );

    const deleteButton = makeElement(
      "button",
      "delete-button",
      "Delete"
    );

    deleteButton.type = "button";

    deleteButton.addEventListener("click", async () => {
      const confirmed = confirm(
        `Delete "${record.name}" from MyTube? This cannot be undone.`
      );

      if (!confirmed) return;

      try {
        await removeVideo(record.id);

        setMessage(`Deleted ${record.name} from MyTube.`);

        await renderLibrary();
        await refreshStorage();

      } catch (error) {
        console.error("Delete failed:", error);

        setMessage(
          `Could not delete video: ${error.message}`,
          true
        );
      }
    });

    details.append(meta);
    actions.append(deleteButton);
    details.append(actions);

    card.append(player, details);
    grid.append(card);
  }

  await refreshStorage();
}

async function importFiles(files) {
  const selected = Array.from(files || []);

  if (!selected.length) return;

  await requestPersistentStorage();

  let imported = 0;
  let failed = 0;
  let lastError = "";

  for (const file of selected) {
    const validVideo =
      file.type.startsWith("video/") ||
      /\.(mp4|webm|m4v|mov|mkv|ogv)$/i.test(file.name);

    if (!validVideo) {
      failed++;
      lastError = `Unsupported file type: ${file.name}`;
      continue;
    }

    try {
      const record = {
        id: createVideoId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        addedAt: Date.now(),
        file: file
      };

      await saveVideo(record);

      imported++;

    } catch (error) {
      failed++;

      console.error(
        `Import failed for ${file.name}:`,
        error
      );

      lastError =
        `${error.name || "Error"}: ${error.message || "Unknown error"}`;

      if (error?.name === "QuotaExceededError") {
        break;
      }
    }
  }

  picker.value = "";

  if (imported > 0 && failed === 0) {
    setMessage(
      `Imported ${imported} video(s). The originals were not deleted.`
    );

  } else if (imported > 0 && failed > 0) {
    setMessage(
      `Imported ${imported} video(s). ${failed} failed. Last error: ${lastError}`,
      true
    );

  } else if (failed > 0) {
    setMessage(
      `No videos were imported. Last error: ${lastError}`,
      true
    );
  }

  try {
    await renderLibrary();
  } catch (error) {
    console.error("Library refresh failed:", error);

    setMessage(
      `Import finished, but library refresh failed: ${error.message}`,
      true
    );
  }
}

picker.addEventListener("change", event => {
  importFiles(event.target.files);
});

search.addEventListener("input", () => {
  renderLibrary().catch(error => {
    console.error("Search failed:", error);
    setMessage("Could not refresh the video library.", true);
  });
});

refreshStorageButton.addEventListener("click", refreshStorage);

function updateNetworkStatus() {
  networkStatus.textContent = navigator.onLine
    ? "Ready"
    : "Offline mode";
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

async function start() {
  updateNetworkStatus();

  try {
    db = await openDatabase();

    await renderLibrary();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js")
        .catch(error => {
          console.warn(
            "Service worker registration failed:",
            error
          );
        });
    }

  } catch (error) {
    console.error("MyTube startup failed:", error);

    setMessage(
      "MyTube could not open its local database in this browser.",
      true
    );
  }
}

window.addEventListener("beforeunload", clearObjectUrls);

start();
