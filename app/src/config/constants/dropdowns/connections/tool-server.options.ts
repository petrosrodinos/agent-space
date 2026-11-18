/** How a custom tool server (§8.4) signs in. */
export const ToolServerAuthOptions = [
  { id: "NONE", label: "None", description: "The server needs no sign-in." },
  { id: "TOKEN", label: "Access token", description: "Paste a token or key from the tool's settings. It is stored encrypted and never shown again." },
  { id: "OAUTH", label: "Sign in", description: "Use the server's own sign-in screen (standard MCP sign-in)." },
] as const;
