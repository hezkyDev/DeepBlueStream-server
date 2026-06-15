const manifest = require("../manifest");

const COLORS = {
    ocean950: "#04101F",
    ocean900: "#071B33",
    ocean800: "#0B2A4A",
    streamBlue: "#0A75C2",
    currentCyan: "#28BDEB",
    textPrimary: "#F6FAFD",
    textSecondary: "#B8C8D5"
};

function renderPage({ title, heading, message, actions = [] }) {
    const actionsHtml = actions
        .map(
            action =>
                `<a class="action" href="${action.href}">${action.label}</a>`
        )
        .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, ${COLORS.ocean950} 0%, ${COLORS.ocean900} 100%);
    color: ${COLORS.textPrimary};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    text-align: center;
  }
  .card {
    max-width: 420px;
    padding: 40px 32px;
  }
  .logo {
    width: 72px;
    height: 72px;
    margin-bottom: 24px;
    border-radius: 16px;
  }
  h1 {
    font-size: 22px;
    margin: 0 0 12px;
  }
  p {
    color: ${COLORS.textSecondary};
    line-height: 1.5;
    margin: 0 0 24px;
    font-size: 14px;
  }
  .actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .action {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 8px;
    background: ${COLORS.streamBlue};
    color: ${COLORS.textPrimary};
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
  }
  .action.secondary {
    background: transparent;
    border: 1px solid rgba(40, 189, 235, 0.4);
    color: ${COLORS.currentCyan};
  }
</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="/logo.png" alt="DeepBlueStream logo" />
    <h1>${heading}</h1>
    <p>${message}</p>
    <div class="actions">${actionsHtml}</div>
  </div>
</body>
</html>`;
}

function renderLandingPage() {
    return renderPage({
        title: manifest.name,
        heading: manifest.name,
        message: manifest.description,
        actions: [
            { label: "Install Addon", href: "/manifest.json" },
            { label: "Status", href: "/status" }
        ]
    });
}

function renderNotFoundPage() {
    return renderPage({
        title: "Not Found - DeepBlueStream",
        heading: "Page not found",
        message: "This page doesn't exist. If you're trying to install the addon, use the link below.",
        actions: [{ label: "Install Addon", href: "/manifest.json" }]
    });
}

module.exports = {
    renderLandingPage,
    renderNotFoundPage
};
