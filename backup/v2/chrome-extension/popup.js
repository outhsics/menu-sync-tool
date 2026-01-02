document.addEventListener('DOMContentLoaded', async () => {
  const envStatus = document.getElementById('env-status');
  const noToken = document.getElementById('no-token');
  const tokenInfo = document.getElementById('token-info');
  const apiOrigin = document.getElementById('api-origin');
  const tenantId = document.getElementById('tenant-id');
  const tokenPreview = document.getElementById('token-preview');
  const copyBtn = document.getElementById('copy-btn');
  const openAppBtn = document.getElementById('open-app-btn');

  // 获取当前标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    envStatus.textContent = '未知';
    return;
  }

  // 向 content script 发送消息获取 token
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getToken' });
    
    if (response && response.token) {
      envStatus.textContent = '已连接';
      envStatus.classList.add('active');
      tokenInfo.style.display = 'block';
      noToken.style.display = 'none';

      apiOrigin.textContent = response.origin;
      tenantId.textContent = response.tenantId;
      tokenPreview.textContent = response.token;

      // 保存到 storage 以备后用（可选）
      chrome.storage.local.set({ 
        lastEnv: {
          apiBase: response.origin,
          token: response.token,
          tenantId: response.tenantId
        }
      });

      // 复制功能
      copyBtn.onclick = () => {
        const data = JSON.stringify({
          apiBase: response.origin,
          token: response.token,
          tenantId: response.tenantId
        }, null, 2);
        
        navigator.clipboard.writeText(data).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✅ 已复制 JSON 配置';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        });
      };

    } else {
      envStatus.textContent = '未登录';
      tokenInfo.style.display = 'none';
      noToken.style.display = 'block';
    }
  } catch (error) {
    console.error(error);
    envStatus.textContent = '连接失败';
    noToken.textContent = '无法连接到页面，请刷新页面重试';
    noToken.style.display = 'block';
  }

  // 打开 Web App
  openAppBtn.onclick = () => {
    chrome.tabs.create({ url: 'http://localhost:5173' }); // 假设本地运行
  };
});
