const W = window.KGWorkspace;
const TEMPLATE_PATH = './templates/mentorship-founder-product-builder.kg.json';

function installMentorshipTemplate() {
  if (!W) return;
  const actions = document.querySelector('.workspace-template-actions');
  if (!actions || actions.querySelector('[data-mentorship-pack]')) return;

  const download = document.createElement('a');
  download.href = TEMPLATE_PATH;
  download.download = 'mentorship-founder-product-builder.kg.json';
  download.dataset.mentorshipPack = 'download';
  download.textContent = 'Mentorship 1:1';
  actions.append(download);

  const useButton = document.createElement('button');
  useButton.type = 'button';
  useButton.className = 'mentorship-template-button';
  useButton.dataset.mentorshipPack = 'use';
  useButton.textContent = 'Use mentorship pack';
  actions.append(useButton);

  useButton.onclick = async () => {
    useButton.disabled = true;
    useButton.textContent = 'Loading…';
    try {
      const response = await W.nativeFetch(TEMPLATE_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Mentorship template unavailable (${response.status}).`);
      const input = await response.json();
      const result = W.validatePack(input);
      if (!result.valid) throw new Error(result.errors.join('\n'));

      const existing = (await W.listWorkspaces()).find((item) => item.id === result.pack.manifest.id && !item.builtin);
      if (existing && !confirm(`Replace existing workspace “${existing.title}”?`)) return;
      if (!existing && !confirm(`Create workspace “${result.pack.manifest.title}”?`)) return;

      await W.activateImportedPack(result.pack);
      location.reload();
    } catch (error) {
      console.error(error);
      alert(`Could not open mentorship pack: ${error.message}`);
    } finally {
      useButton.disabled = false;
      useButton.textContent = 'Use mentorship pack';
    }
  };
}

const style = document.createElement('style');
style.textContent = `
  .workspace-template-actions .mentorship-template-button {
    min-height: 34px;
    border: 1px solid #c7d2fe;
    border-radius: 9px;
    background: #eef2ff;
    color: #4338ca;
    font: inherit;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
  }
  .workspace-template-actions .mentorship-template-button:hover { background: #e0e7ff; }
  .workspace-template-actions .mentorship-template-button:disabled { cursor: wait; opacity: .65; }
`;
document.head.append(style);

installMentorshipTemplate();
const observer = new MutationObserver(installMentorshipTemplate);
observer.observe(document.body, { childList: true, subtree: true });
