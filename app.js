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

function openDatabase() {
return new Promise((resolve, reject) => {
const request = indexedDB.open(DB_NAME, DB_VERSION);
request.onupgradeneeded = () => {
const database = request.result;
if (!database.objectStoreNames.contains(STORE_NAME)) {
const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
store.createIndex("name", "name", { unique: false });
store.createIndex("addedAt", "addedAt", { unique: false });
}
};
request.onsuccess = () => resolve(request.result);
request.onerror = () => reject(request.error);
});
}

function storeRequest(mode, action) {
return new Promise((resolve, reject) => {
const tx = db.transaction(STORE_NAME, mode);
const store = tx.objectStore(STORE_NAME);
let request;
try {
request = action(store);
} catch (error) {
reject(error);
return;
}
tx.oncomplete = () => resolve(request ? request.result : undefined);
tx.onerror = () => reject(tx.error || request?.error);
tx.onabort = () => reject(tx.error || new Error("Storage operation was cancelled."));
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
if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
const units = ["B", "KB", "MB", "GB", "TB"];
let value = bytes;
let unit = 0;
while (value >= 1024 && unit < units.length - 1) {
value /= 1024;
unit++;
}
return ${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]};
}

function setMessage(text, isError = false) {
message.textContent = text;
message.style.color = isError ? "#ff9da8" : "#aab7ff";
}

async function refreshStorage() {
if (!navigator.storage?.estimate) {
storageInfo.textContent = "Storage estimates are not available in this browser.";
return;
}
try {
const estimate = await navigator.storage.estimate();
const used = estimate.usage ?? 0;
const quota = estimate.quota ?? 0;
storageInfo.textContent = quota
? ${formatBytes(used)} used of approximately ${formatBytes(quota)} available to this browser
: ${formatBytes(used)} used;
} catch {
storageInfo.textContent = "Could not read storage information.";
}
}

async function requestPersistentStorage() {
if (navigator.storage?.persist) {
try {
const granted = await navigator.storage.persist();
if (!granted) {
setMessage("Browser storage may still be cleared by device/browser storage management.");
}
} catch {
// Persistence is optional; imports can still work.
}
}
}

function makeElement(tag, className, text) {
const element = document.createElement(tag);
if (className) element.className = className;
if (text !== undefined) element.textContent = text;
return element;
}

function clearObjectUrls() {
for (const url of objectUrls) URL.revokeObjectURL(url);
objectUrls = [];
}

async function renderLibrary() {
clearObjectUrls();
const allVideos = await getAllVideos();
const query = search.value.trim().toLocaleLowerCase();
const videos = allVideos
.filter(video => video.name.toLocaleLowerCase().includes(query))
.sort((a, b) => b.addedAt - a.addedAt);

grid.replaceChildren();
count.textContent = ${videos.length} ${videos.length === 1 ? "video" : "videos"};

emptyState.hidden = allVideos.length !== 0;
if (allVideos.length > 0 && videos.length === 0) {
const noResults = makeElement("p", "message", "No videos match your search.");
grid.append(noResults);
}

for (const record of videos) {
const card = makeElement("article", "video-card");
const player = makeElement("video");
player.controls = true;
player.preload = "metadata";
player.playsInline = true;
player.setAttribute("aria-label", Play ${record.name});
const url = URL.createObjectURL(record.file);
objectUrls.push(url);
player.src = url;

const details = makeElement("div", "video-details");  
details.append(makeElement("h3", "video-title", record.name));  
const meta = makeElement("div", "video-meta");  
meta.append(  
  makeElement("span", "", formatBytes(record.size)),  
  makeElement("span", "", new Date(record.addedAt).toLocaleDateString())  
);  

const actions = makeElement("div", "card-actions");  
actions.append(makeElement("span", "video-meta", "Stored on this device"));  
const deleteButton = makeElement("button", "delete-button", "Delete");  
deleteButton.type = "button";  
deleteButton.addEventListener("click", async () => {  
  const confirmed = confirm(`Delete "${record.name}" from MyTube? This cannot be undone.`);  
  if (!confirmed) return;  
  await removeVideo(record.id);  
  setMessage(`Deleted ${record.name} from MyTube.`);  
  await renderLibrary();  
  await refreshStorage();  
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
if (!file.type.startsWith("video/") && !/.(mp4|webm|m4v|mov|mkv|ogv)$/i.test(file.name)) {
failed++;
continue;
}

try {  
  const record = {  
    id: crypto.randomUUID(),  
    name: file.name,  
    type: file.type || "application/octet-stream",  
    size: file.size,  
    addedAt: Date.now(),  
    file  
  };  
  await saveVideo(record);  
  imported++;  
} catch (error) {
  failed++;

  lastError = `${error?.name || "Unknown error"}: ${error?.message || "No details available"}`;

  console.error("MyTube database import error:", error);

  if (error?.name === "QuotaExceededError") {
    break;
  }
}
  console.error("MyTube import error:", {
    name: error?.name,
    message: error?.message,
    fileName: file.name,
    fileSize: file.size
  });

  setMessage(
    `Import failed: ${error?.name || "Unknown error"} - ${error?.message || "No details available"}`,
    true
  );

  if (error?.name === "QuotaExceededError") {
    break;
  }
}

picker.value = "";
if (imported > 0) {
setMessage(Imported ${imported} video(s). The originals were not deleted.);
} else if (failed > 0) {
setMessage(`Import failed: ${lastError}`, true);
}
await renderLibrary();
}

picker.addEventListener("change", event => importFiles(event.target.files));
search.addEventListener("input", () => renderLibrary());
refreshStorageButton.addEventListener("click", refreshStorage);

function updateNetworkStatus() {
networkStatus.textContent = navigator.onLine ? "Ready" : "Offline mode";
}
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

async function start() {
updateNetworkStatus();
try {
db = await openDatabase();
await renderLibrary();
if ("serviceWorker" in navigator) {
navigator.serviceWorker.register("./sw.js").catch(error => {
console.warn("Service worker registration failed:", error);
});
}
} catch (error) {
console.error(error);
setMessage("MyTube could not open its local database in this browser.", true);
}
}

window.addEventListener("beforeunload", clearObjectUrls);
start();
