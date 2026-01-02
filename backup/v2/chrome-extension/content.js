// Content Script - Only for extracting token
console.log('Menu Sync Tool Content Letter Loaded');

function cleanToken(token) {
  if (!token) return '';
  return token.replace(/^Bearer\s+/gi, '').trim();
}

function getEnvironmentInfo() {
  const token = localStorage.getItem('ACCESS_TOKEN') ||
                sessionStorage.getItem('ACCESS_TOKEN');
  
  const tenantId = localStorage.getItem('TenantId') ||
                  localStorage.getItem('__tenant_id__') ||
                  sessionStorage.getItem('TenantId');

  return {
    token: cleanToken(token),
    tenantId: tenantId || '1',
    hostname: window.location.hostname,
    origin: window.location.origin
  };
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getToken') {
    const info = getEnvironmentInfo();
    sendResponse(info);
  }
  return true;
});
