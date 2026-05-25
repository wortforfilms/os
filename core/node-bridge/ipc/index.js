export function createMessageBus() {
  const subscribers = new Map();

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
  };
}
