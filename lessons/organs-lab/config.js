// Optional settings for the lesson. Edit and redeploy.
window.WEBXR_CLASSES_CONFIG = {
  // URL of a server endpoint that answers student questions with an AI model (the "AI doctor").
  // It receives POST JSON { question, context, audience } and must reply with JSON { answer }.
  // Leave null to use only the built-in (offline) answers.
  doctorEndpoint: null,
};
