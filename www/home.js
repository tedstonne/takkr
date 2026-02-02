// Go to board component
window.goToBoard = () => ({
  slug: "",

  go() {
    if (this.slug) {
      window.location.href = `/${this.slug.toLowerCase().trim()}`;
    }
  },

  handleKey(e) {
    if (e.key === "Enter") {
      this.go();
    }
  },
});
