const { startAuthentication, startRegistration } = SimpleWebAuthnBrowser;

const errors = [
  [/timed out|not allowed/i, "Passkey cancelled or timed out"],
  [/abort/i, "Passkey cancelled"],
  [/InvalidStateError/i, "Passkey already registered"],
  [/SecurityError/i, "Secure connection required"],
  [/NotSupportedError/i, "Passkeys not supported"],
];

const humanize = (err) => {
  const msg = err.message || String(err);
  const match = errors.find(([pattern]) => pattern.test(msg));

  return match ? match[1] : msg;
};

const notify = (message) => {
  const alert = document.getElementById("hx-alert");
  if (alert) {
    alert.textContent = message;
    alert.classList.add("error");
  }
};

// Registration flow
window.register = () => ({
  username: "",

  async submit() {
    const username = this.username.toLowerCase().trim();

    if (!username || username.length < 3) {
      notify("Username must be at least 3 characters");
      return;
    }

    try {
      const response = await fetch(`/api/user/register?username=${username}`, {
        method: "POST",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to start registration");
      }

      const challenge = await response.json();
      const attestation = await startRegistration({ optionsJSON: challenge });
      const encoded = btoa(JSON.stringify(attestation));

      htmx.ajax("POST", "/api/user/register/verify", {
        target: "#hx-body",
        swap: "innerHTML",
        values: { username, credential: encoded },
      });
    } catch (err) {
      notify(humanize(err));
    }
  },
});

// Discoverable login - shows passkey picker without knowing username
window.discover = () => ({
  async submit() {
    try {
      const response = await fetch("/api/user/discover", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to get challenge");
      }

      const options = await response.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const encoded = btoa(JSON.stringify(assertion));

      htmx.ajax("POST", "/api/user/discover/verify", {
        target: "#hx-body",
        swap: "innerHTML",
        values: { credential: encoded },
      });
    } catch (err) {
      notify(humanize(err));
    }
  },
});
