import { getEmailConfig } from "../lib/email/config.ts";

try {
  const config = getEmailConfig();
  if (config.deliveryMode !== "postmark" || config.serverToken === "POSTMARK_API_TEST") {
    throw new Error("Configure a real Postmark server token to verify the account (no email is sent).");
  }
  async function read(path) {
    const response = await fetch(`https://api.postmarkapp.com${path}`, {
      headers: { Accept: "application/json", "X-Postmark-Server-Token": config.serverToken },
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Postmark verification HTTP ${response.status}`);
    return response.json();
  }
  const [server, transactional, broadcast] = await Promise.all([
    read("/server"),
    read(`/message-streams/${encodeURIComponent(config.transactionalStream)}`),
    read(`/message-streams/${encodeURIComponent(config.broadcastStream)}`),
  ]);
  if (server.DeliveryType !== "Live") throw new Error("Postmark server is not Live.");
  if (transactional.MessageStreamType !== "Transactional" || transactional.ArchivedAt) throw new Error("Invalid transactional stream.");
  if (broadcast.MessageStreamType !== "Broadcasts" || broadcast.ArchivedAt) throw new Error("Invalid broadcast stream.");
  console.log("Postmark credentials and stream types verified. No email sent. Account approval, sender DNS and actual delivery must also be checked.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
