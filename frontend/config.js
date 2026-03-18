window.APP_CONFIG = {
  API_BASE_URL: window.__APP_API_BASE_URL__ || "",
  COGNITO_DOMAIN: window.__APP_COGNITO_DOMAIN__ || "",
  CLIENT_ID: window.__APP_CLIENT_ID__ || "",
  REDIRECT_PATH: window.__APP_REDIRECT_PATH__ || "/dashboard.html",

  ROUTES: {
    UPLOAD: "/upload_url",
    FILES: "/files",
    DELETE_FILE: "/file",
    SHARE_FILE: "/share",
    SHARE_FOLDER: "/share/folder"
  },

  UPLOAD_MODES: {
    FILES: "files",
    FOLDER: "folder"
  },

  DEFAULTS: {
    EMPTY_SELECTION: "No items selected",
    EMPTY_FILES: "No files uploaded yet",
    COPYING: "Copied!"
  }
};

window.APP_CONFIG.REDIRECT_URI =
  `${window.location.origin}${window.APP_CONFIG.REDIRECT_PATH}`;