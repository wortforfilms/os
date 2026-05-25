export function createMessageBus() {
  const subscribers = new Map();
  const binaryChannels = new Map();

  function getRing(topic) {
    const existing = binaryChannels.get(topic);
    if (existing) {
      return existing;
    }

    const ring = {
      frames: [],
      maxFrames: 64,
    };
    binaryChannels.set(topic, ring);
    return ring;
  }

  return {
    publish(topic, payload) {
      for (const subscriber of subscribers.get(topic) ?? []) {
        subscriber(payload);
      }
    },
    subscribe(topic, subscriber) {
      const topicSubscribers = subscribers.get(topic) ?? new Set();
      topicSubscribers.add(subscriber);
      subscribers.set(topic, topicSubscribers);
      return () => topicSubscribers.delete(subscriber);
    },
    writeFrame(topic, frame) {
      const ring = getRing(topic);
      const buffer = Buffer.isBuffer(frame) ? Buffer.from(frame) : Buffer.from(frame);
      ring.frames.push(buffer);
      if (ring.frames.length > ring.maxFrames) {
        ring.frames.shift();
      }
      this.publish(topic, { topic, bytes: buffer.byteLength, frames: ring.frames.length });
      return { topic, bytes: buffer.byteLength, frames: ring.frames.length };
    },
    readFrames(topic) {
      return getRing(topic).frames.map((frame) => Buffer.from(frame));
    },
  };
}
