export function getPluginBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_PLUGIN_URL?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

export function buildInstallSnippet(pluginId: string) {
  const base = getPluginBaseUrl();
  return `<script
  src="${base}/v1/plugin.js"
  data-plugin="${pluginId}"
  async
></script>`;
}
