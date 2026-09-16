// Clicking the toolbar icon toggles the in-page floating panel, instead of
// opening a browser_action popup.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'tc-toggle-panel' }, () => void chrome.runtime.lastError);
});
