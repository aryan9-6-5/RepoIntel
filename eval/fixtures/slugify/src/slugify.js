// Lowercase, hyphen-separated slug with no leading or trailing hyphens.
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-/, '');
}

module.exports = { slugify };
