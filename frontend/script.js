const CONFIG = window.APP_CONFIG;

let selectedFiles = [];
let uploadMode = CONFIG.UPLOAD_MODES.FILES;

function buildUrl(path) {
  return `${CONFIG.API_BASE_URL}${path}`;
}

function getToken() {
  return localStorage.getItem("id_token");
}

function headers(json = true) {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function logout() {
  localStorage.removeItem("id_token");
  window.location.href = "index.html";
}

function setUploadMode(mode) {
  uploadMode = mode;
  selectedFiles = [];
  renderPreview();

  document.getElementById("fileUploadSection").style.display =
    mode === CONFIG.UPLOAD_MODES.FILES ? "block" : "none";

  document.getElementById("folderUploadSection").style.display =
    mode === CONFIG.UPLOAD_MODES.FOLDER ? "block" : "none";

  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");
  if (fileInput) fileInput.value = "";
  if (folderInput) folderInput.value = "";
}

function previewFiles() {
  const files = Array.from(document.getElementById("fileInput").files || []);
  selectedFiles = files.map(f => ({
    file: f,
    displayName: f.name,
    relativePath: f.name
  }));
  renderPreview();
  updatePreviewCount();
}

function previewFolder() {
  const files = Array.from(document.getElementById("folderInput").files || []);
  selectedFiles = files.map(f => ({
    file: f,
    displayName: f.webkitRelativePath || f.name,
    relativePath: f.webkitRelativePath || f.name
  }));
  renderPreview();
  updatePreviewCount();
}

function renderPreview() {
  const list = document.getElementById("selectedFileList");
  list.innerHTML = "";

  if (!selectedFiles.length) {
    list.innerHTML = `<li class="empty-state">${CONFIG.DEFAULTS.EMPTY_SELECTION}</li>`;
    updatePreviewCount();
    return;
  }

  selectedFiles.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "preview-item";
    li.innerHTML = `
      <div class="preview-item-left">
        <div class="preview-name">${escapeHtml(item.displayName)}</div>
        <div class="preview-meta">${formatFileSize(item.file.size)}</div>
      </div>
      <button class="preview-remove-btn" onclick="removeFile(${i})">Remove</button>
    `;
    list.appendChild(li);
  });

  updatePreviewCount();
}

function updatePreviewCount() {
  const el = document.getElementById("previewCount");
  if (!el) return;
  el.textContent = `${selectedFiles.length} item${selectedFiles.length === 1 ? "" : "s"}`;
}

function removeFile(i) {
  selectedFiles.splice(i, 1);
  renderPreview();
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function expiry() {
  return (
    (+expiryDays.value * 86400) +
    (+expiryHours.value * 3600) +
    (+expiryMinutes.value * 60)
  );
}

function folderCode() {
  return crypto.randomUUID().slice(0, 10);
}

async function uploadFile() {
  if (!selectedFiles.length) return alert("Select files or a folder");

  const code = uploadMode === CONFIG.UPLOAD_MODES.FOLDER ? folderCode() : "";
  const uploadButton = document.querySelector(".primary-btn");
  const originalText = uploadButton.textContent;
  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";

  try {
    for (const item of selectedFiles) {
      const res = await fetch(buildUrl(CONFIG.ROUTES.UPLOAD), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          fileName: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          expirySeconds: expiry(),
          folder: folderNameInput.value,
          relativePath: item.relativePath,
          uploadMode,
          folderShareCode: code
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate upload link");
      }

      const putRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": item.file.type || "application/octet-stream" },
        body: item.file
      });

      if (!putRes.ok) {
        throw new Error(`Failed to upload ${item.file.name}`);
      }
    }

    if (uploadMode === CONFIG.UPLOAD_MODES.FOLDER) {
      const link = `${buildUrl(CONFIG.ROUTES.SHARE_FOLDER)}/${code}`;
      await navigator.clipboard.writeText(link);
      alert("Folder link copied");
    } else {
      alert("Upload completed");
    }

    selectedFiles = [];
    renderPreview();
    loadFiles();
  } catch (error) {
    alert(error.message || "Upload failed");
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = originalText;
  }
}

function groupItems(files) {
  const groupedFolders = {};
  const individualFiles = [];

  files.forEach(file => {
    if (file.uploadMode === CONFIG.UPLOAD_MODES.FOLDER && file.folderShareCode) {
      if (!groupedFolders[file.folderShareCode]) {
        groupedFolders[file.folderShareCode] = {
          folderShareCode: file.folderShareCode,
          folder: file.folder || CONFIG.DEFAULTS.UPLOAD_FOLDER_LABEL,
          items: []
        };
      }
      groupedFolders[file.folderShareCode].items.push(file);
    } else {
      individualFiles.push(file);
    }
  });

  return {
    folders: Object.values(groupedFolders),
    files: individualFiles
  };
}

async function loadFiles() {
  const res = await fetch(buildUrl(CONFIG.ROUTES.FILES), {
    headers: headers(false)
  });

  const data = await res.json();
  const list = document.getElementById("fileList");
  list.innerHTML = "";

  if (!res.ok) {
    list.innerHTML = `<li class="empty-state">Failed to load items</li>`;
    return;
  }

  if (!(data.files || []).length) {
    list.innerHTML = `<li class="empty-state">${CONFIG.DEFAULTS.EMPTY_FILES}</li>`;
    return;
  }

  const grouped = groupItems(data.files);

  grouped.folders.forEach(folderGroup => {
    const li = document.createElement("li");
    li.className = "file-row folder-row";
    li.innerHTML = `
      <div class="file-row-left">
        <div class="file-title">📁 ${escapeHtml(folderGroup.folder)}</div>
        <div class="file-subtitle">${folderGroup.items.length} file(s)</div>
      </div>
      <div class="file-row-right">
        <button class="file-action-btn" onclick="copyFolderLink('${folderGroup.folderShareCode}', this)">Copy Folder Link</button>
      </div>
    `;
    list.appendChild(li);
  });

  grouped.files.forEach(file => {
    const li = document.createElement("li");
    li.className = "file-row";
    li.innerHTML = `
      <div class="file-row-left">
        <div class="file-title">${escapeHtml(file.fileName)}</div>
        <div class="file-subtitle">${file.folder ? `Folder: ${escapeHtml(file.folder)}` : "Standalone file"}</div>
      </div>
      <div class="file-row-right">
        <button class="file-action-btn" onclick="copyFileLink('${file.shortCode}', this)">Copy File Link</button>
        <button class="delete-btn" onclick="del('${file.fileId}')">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

async function copy(text, button) {
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = "Copied!";
  setTimeout(() => {
    button.textContent = original;
  }, 2000);
}

async function copyFileLink(code, button) {
  const link = `${buildUrl(CONFIG.ROUTES.SHARE_FILE)}/${code}`;
  await copy(link, button);
}

async function copyFolderLink(code, button) {
  const link = `${buildUrl(CONFIG.ROUTES.SHARE_FOLDER)}/${code}`;
  await copy(link, button);
}

async function del(id) {
  await fetch(buildUrl(CONFIG.ROUTES.DELETE_FILE), {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ fileId: id })
  });
  loadFiles();
}

window.onload = () => {
  if (!getToken()) location.href = "index.html";
  renderPreview();
  loadFiles();
};