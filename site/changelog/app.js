const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
async function init() {
  const timeline = document.querySelector('#timeline');
  try {
    const response = await fetch('../data/project-history.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const history = await response.json();
    document.querySelector('#release-count').textContent = `${history.entries.length} releases documented`;
    timeline.innerHTML = history.entries.map((entry) => `
      <article class="timeline-entry">
        <header><div><div class="docs-eyebrow">${esc(entry.version)}</div><h2>${esc(entry.title)}</h2></div><time datetime="${esc(entry.date)}">${new Date(`${entry.date}T00:00:00`).toLocaleDateString('vi-VN',{day:'2-digit',month:'long',year:'numeric'})}</time></header>
        <p>${esc(entry.summary)}</p>
        <div class="timeline-tags">${entry.tags.map((tag) => `<span>#${esc(tag)}</span>`).join('')}</div>
        <ul>${entry.changes.map((change) => `<li>${esc(change)}</li>`).join('')}</ul>
        ${entry.commit ? `<a class="commit-link" href="https://github.com/huygdv/knowledge-graph/commit/${encodeURIComponent(entry.commit)}">commit ${esc(entry.commit.slice(0,10))} ↗</a>` : '<span class="commit-link">current release · deployment pending</span>'}
      </article>`).join('');
  } catch (error) {
    timeline.innerHTML = `<article class="timeline-entry"><h2>Không tải được changelog</h2><p>${esc(error.message)}</p></article>`;
  }
}
init();
