let selectedFiles = [];

function getIdToken() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("id_token") || localStorage.getItem("id_token");
}

function saveToken() {
  const token = getIdToken();
  if (token) {
    localStorage.setItem("id_token", token);
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }
  }
}

function getAuthHeaders(isJson = true) {
  const token = localStorage.getItem("id_token");
  const headers = {
    Authorization: `Bearer ${token}`
  };

  if (isJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function logout() {
  localStorage.removeItem("id_token");
  window.location.href = "index.html";
}

function previewFiles() {
  const fileInput = document.getElementById("fileInput");
  const files = Array.from(fileInput.files || []);

  selectedFiles = [...selectedFiles, ...files];
  renderPreview();

  // clear input so same file can be re-selected later if needed
  fileInput.value = "";
}

function renderPreview() {
  const selectedFileList = document.getElementById("selectedFileList");
  selectedFileList.innerHTML = "";

  if (selectedFiles.length === 0) {
    selectedFileList.innerHTML = "<li>No files selected</li>";
    return;
  }

  selectedFiles.forEach((file, index) => {
    const li = document.createElement("li");
    const fileSizeKB = (file.size / 1024).toFixed(2);

    li.innerHTML = `
  <span>${file.name} (${fileSizeKB} KB)</span>
  <button onclick="removeFile(${index})" style="margin-left:10px;color:red;">Remove</button>
`;

    selectedFileList.appendChild(li);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderPreview();
}

async function uploadSingleFile(file) {
  const response = await fetch(`${CONFIG.apiBaseUrl}/upload_url`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Failed to generate upload URL for ${file.name}`);
  }

  const uploadResponse = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload ${file.name} to S3`);
  }

  return {
    fileName: file.name,
    fileId: data.fileId,
    s3Key: data.s3Key
  };
}

async function uploadFile() {
  if (selectedFiles.length === 0) {
    alert("Please select at least one file");
    return;
  }

  const uploadButton = document.querySelector('button[onclick="uploadFile()"]');
  const originalButtonText = uploadButton.textContent;
  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";

  const successFiles = [];
  const failedFiles = [];

  for (const file of selectedFiles) {
    try {
      await uploadSingleFile(file);
      successFiles.push(file.name);
    } catch (error) {
      failedFiles.push(`${file.name}: ${error.message}`);
    }
  }

  uploadButton.disabled = false;
  uploadButton.textContent = originalButtonText;

  if (successFiles.length > 0 && failedFiles.length === 0) {
    alert(`${successFiles.length} file(s) uploaded successfully`);
  } else if (successFiles.length > 0 && failedFiles.length > 0) {
    alert(
      `${successFiles.length} file(s) uploaded successfully.\n\nFailed uploads:\n${failedFiles.join("\n")}`
    );
  } else {
    alert(`All uploads failed.\n\n${failedFiles.join("\n")}`);
  }

  selectedFiles = [];
  renderPreview();
  loadFiles();
}

async function loadFiles() {
  const response = await fetch(`${CONFIG.apiBaseUrl}/files`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("id_token")}`
    }
  });

  const data = await response.json();
  const fileList = document.getElementById("fileList");
  fileList.innerHTML = "";

  if (!response.ok) {
    alert(data.error || "Failed to fetch files");
    return;
  }

  if (!data.files || data.files.length === 0) {
    fileList.innerHTML = "<li>No files uploaded yet.</li>";
    return;
  }

  data.files.forEach(file => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${file.fileName}</strong>
      <button onclick="copyDownloadLink('${file.fileId}', this)">Copy Link</button>
      <button onclick="deleteFile('${file.fileId}')">Delete</button>
    `;
    fileList.appendChild(li);
  });
}

async function copyDownloadLink(fileId, buttonElement) {
  const response = await fetch(`${CONFIG.apiBaseUrl}/download_url`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify({ fileId })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Failed to generate download URL");
    return;
  }

  try {
    await navigator.clipboard.writeText(data.downloadUrl);
    const originalText = buttonElement.textContent;
    buttonElement.textContent = "Copied!";
    setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 2000);
  } catch (error) {
    alert("Failed to copy link");
  }
}

async function deleteFile(fileId) {
  const response = await fetch(`${CONFIG.apiBaseUrl}/file`, {
    method: "DELETE",
    headers: getAuthHeaders(true),
    body: JSON.stringify({ fileId })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Failed to delete file");
    return;
  }

  alert("File deleted successfully");
  loadFiles();
}

window.onload = function () {
  saveToken();

  if (!localStorage.getItem("id_token")) {
    window.location.href = "index.html";
    return;
  }

  renderPreview();
  loadFiles();
};