import posthog from "posthog-js";

function trackEvent(name, props = {}) {
  try {
    posthog.capture(name, props);
  } catch (e) {}
}

function identifyUser(userId, props) {
  try {
    posthog.identify(userId, props);
  } catch (e) {}
}

function resetAnalytics() {
  try {
    posthog.reset();
  } catch (e) {}
}

export { identifyUser, resetAnalytics, trackEvent };
