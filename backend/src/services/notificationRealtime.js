const userStreams = new Map();

function getSet(userId) {
  const key = String(userId || "");
  if (!userStreams.has(key)) userStreams.set(key, new Set());
  return userStreams.get(key);
}

export function subscribeUserStream(userId, res) {
  const set = getSet(userId);
  set.add(res);
}

export function unsubscribeUserStream(userId, res) {
  const key = String(userId || "");
  const set = userStreams.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) userStreams.delete(key);
}

export function publishUserNotification(userId, payload) {
  const key = String(userId || "");
  const set = userStreams.get(key);
  if (!set || set.size === 0) return;
  const data = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      set.delete(res);
    }
  }
  if (set.size === 0) userStreams.delete(key);
}

