/* ==========================================================================
   Nexus AI Studio - OpenRouter AI Chatbot Core Application Engine
   ========================================================================== */

/**
 * 🔑 OpenRouter API Key Configuration
 * ==========================================================================
 * 실습용 키를 아래 변수에 직접 입력하세요. (예: "sk-or-v1-xxxxxxxx...")
 * 설정 모달 UI에서도 언제든지 키를 추가하거나 변경할 수 있으며, 
 * UI에서 변경된 키는 브라우저 localStorage에 안전하게 보관됩니다.
 */
let OPENROUTER_API_KEY = ""; // 👈 여기에 OpenRouter API 키를 직접 넣을 수 있습니다.

// App State
const state = {
  sessions: [],
  activeSessionId: null,
  isGenerating: false,
  abortController: null,
  settings: {
    apiKey: localStorage.getItem("nexus_api_key") || OPENROUTER_API_KEY,
    systemPrompt: localStorage.getItem("nexus_system_prompt") || "당신은 Nexus AI Studio의 유능하고 친절하며 정확한 AI 어시스턴트입니다.",
    temperature: parseFloat(localStorage.getItem("nexus_temperature")) || 0.7,
    maxTokens: parseInt(localStorage.getItem("nexus_max_tokens")) || 2048,
    stream: localStorage.getItem("nexus_stream") !== "false",
    webSearch: localStorage.getItem("nexus_web_search") !== "false",
  }
};

// DOM Elements
const elements = {
  sidebar: document.getElementById("sidebar"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  historyList: document.getElementById("historyList"),
  clearAllHistoryBtn: document.getElementById("clearAllHistoryBtn"),
  
  modelSelect: document.getElementById("modelSelect"),
  customModelBar: document.getElementById("customModelBar"),
  customModelInput: document.getElementById("customModelInput"),
  applyCustomModelBtn: document.getElementById("applyCustomModelBtn"),
  
  statusBadge: document.getElementById("statusBadge"),
  statusText: document.getElementById("statusText"),
  exportChatBtn: document.getElementById("exportChatBtn"),
  headerSettingsBtn: document.getElementById("headerSettingsBtn"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  
  chatMessages: document.getElementById("chatMessages"),
  welcomeScreen: document.getElementById("welcomeScreen"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  stopBtn: document.getElementById("stopBtn"),
  charCount: document.getElementById("charCount"),
  
  settingsModal: document.getElementById("settingsModal"),
  closeSettingsModalBtn: document.getElementById("closeSettingsModalBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  webSearchToggleBtn: document.getElementById("webSearchToggleBtn"),
  webSearchModalToggle: document.getElementById("webSearchModalToggle"),
  toggleApiKeyVisibility: document.getElementById("toggleApiKeyVisibility"),
  systemPromptInput: document.getElementById("systemPromptInput"),
  tempSlider: document.getElementById("tempSlider"),
  tempVal: document.getElementById("tempVal"),
  maxTokensSlider: document.getElementById("maxTokensSlider"),
  maxTokensVal: document.getElementById("maxTokensVal"),
  streamToggle: document.getElementById("streamToggle"),
};

// Preset System Prompts
const PRESETS = {
  default: "당신은 Nexus AI Studio의 유능하고 친절하며 정확한 AI 어시스턴트입니다.",
  coder: "당신은 최고 수준의 시니어 풀스택 소프트웨어 엔지니어입니다. 간결하고 버그 없는 최적화된 코드와 명확한 주석으로 답변하세요.",
  concise: "모든 질문에 부연 설명 없이 명확하고 군더더기 없는 핵심만을 bullet point 형태로 답변하세요.",
  friendly: "친근하고 따뜻한 어조로 세심하게 설명해주는 인공지능 선생님입니다. 격려하는 말투로 쉬운 비유를 활용하세요."
};

/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  setupMarked();
  loadSessionsFromStorage();
  initEventListeners();
  
  // Create initial session if none exists
  if (state.sessions.length === 0) {
    createNewSession();
  } else {
    switchSession(state.sessions[0].id);
  }
  
  // Sync UI settings input values
  syncSettingsUI();
});

/* Configure Marked.js for Code Syntax Highlighting & Copy Buttons */
function setupMarked() {
  const renderer = new marked.Renderer();
  
  renderer.code = function (code, lang) {
    const validLanguage = hljs.getLanguage(lang) ? lang : 'plaintext';
    let highlighted = code;
    try {
      highlighted = hljs.highlight(code, { language: validLanguage }).value;
    } catch (e) {
      highlighted = code;
    }

    const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span class="code-lang"><i class="fa-solid fa-code"></i> ${validLanguage}</span>
          <button class="copy-code-btn" onclick="copyCodeToClipboard('${codeId}')">
            <i class="fa-regular fa-copy"></i> 코드 복사
          </button>
        </div>
        <pre><code id="${codeId}" class="hljs ${validLanguage}">${highlighted}</code></pre>
      </div>
    `;
  };

  marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: true
  });
}

// Window global helper for code copy button
window.copyCodeToClipboard = function (codeId) {
  const codeElement = document.getElementById(codeId);
  if (!codeElement) return;
  
  const text = codeElement.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.closest('.code-block-wrapper').querySelector('.copy-code-btn');
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check" style="color: var(--success);"></i> 복사됨!`;
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 2000);
    }
  });
};

/* ==========================================================================
   Session Management & LocalStorage
   ========================================================================== */
function loadSessionsFromStorage() {
  const saved = localStorage.getItem("nexus_chat_sessions");
  if (saved) {
    try {
      state.sessions = JSON.parse(saved);
    } catch (e) {
      state.sessions = [];
    }
  }
}

function saveSessionsToStorage() {
  localStorage.setItem("nexus_chat_sessions", JSON.stringify(state.sessions));
}

function createNewSession() {
  const newSession = {
    id: 'session_' + Date.now(),
    title: '새로운 대화',
    model: elements.modelSelect.value === 'custom' ? elements.customModelInput.value : elements.modelSelect.value,
    messages: [],
    createdAt: new Date().toISOString()
  };

  state.sessions.unshift(newSession);
  saveSessionsToStorage();
  renderHistoryList();
  switchSession(newSession.id);
}

function switchSession(sessionId) {
  state.activeSessionId = sessionId;
  renderHistoryList();
  renderActiveChat();
}

function getActiveSession() {
  return state.sessions.find(s => s.id === state.activeSessionId);
}

function deleteSession(sessionId, event) {
  if (event) event.stopPropagation();
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  saveSessionsToStorage();

  if (state.sessions.length === 0) {
    createNewSession();
  } else if (state.activeSessionId === sessionId) {
    switchSession(state.sessions[0].id);
  } else {
    renderHistoryList();
  }
}

function renderHistoryList() {
  elements.historyList.innerHTML = '';
  state.sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = `history-item ${session.id === state.activeSessionId ? 'active' : ''}`;
    item.onclick = () => switchSession(session.id);

    item.innerHTML = `
      <i class="fa-regular fa-message"></i>
      <span class="history-item-text">${escapeHtml(session.title)}</span>
      <div class="history-item-actions">
        <button class="history-action-icon" title="삭제" onclick="deleteSession('${session.id}', event)">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    elements.historyList.appendChild(item);
  });
}

function renderActiveChat() {
  const session = getActiveSession();
  if (!session) return;

  // Clear chat area
  elements.chatMessages.innerHTML = '';

  if (session.messages.length === 0) {
    elements.chatMessages.appendChild(elements.welcomeScreen);
    elements.welcomeScreen.classList.remove('hidden');
  } else {
    elements.welcomeScreen.classList.add('hidden');
    session.messages.forEach(msg => {
      appendMessageToUI(msg.role, msg.content);
    });
    scrollToBottom();
  }
}

/* ==========================================================================
   UI Message Rendering
   ========================================================================== */
function appendMessageToUI(role, content = '') {
  elements.welcomeScreen.classList.add('hidden');

  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  
  const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
  const authorName = role === 'user' ? '사용자' : 'Nexus AI';

  row.innerHTML = `
    <div class="message-avatar">${avatarIcon}</div>
    <div class="message-content-wrapper">
      <div class="message-author">${authorName}</div>
      ${role === 'assistant' && state.settings.webSearch ? `
        <div class="web-search-badge"><i class="fa-solid fa-globe"></i> 실시간 웹 검색 활성화됨</div>
      ` : ''}
      <div class="message-body">${role === 'user' ? escapeHtml(content) : marked.parse(content)}</div>
      ${role === 'assistant' ? `
        <div class="message-actions">
          <button class="msg-action-btn" onclick="copyMessageText(this)"><i class="fa-regular fa-copy"></i> 복사</button>
        </div>
      ` : ''}
    </div>
  `;

  elements.chatMessages.appendChild(row);
  scrollToBottom();
  return row;
}

window.copyMessageText = function (btn) {
  const body = btn.closest('.message-content-wrapper').querySelector('.message-body');
  if (body) {
    navigator.clipboard.writeText(body.innerText).then(() => {
      btn.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success)"></i> 복사됨`;
      setTimeout(() => {
        btn.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
      }, 2000);
    });
  }
};

function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   OpenRouter API Interaction (Streaming & Fallback)
   ========================================================================== */
async function sendMessage() {
  const text = elements.userInput.value.trim();
  if (!text || state.isGenerating) return;

  const activeApiKey = state.settings.apiKey || OPENROUTER_API_KEY;

  if (!activeApiKey || activeApiKey === "") {
    alert("오픈라우터 API 키가 설정되지 않았습니다.\n\n코드 상단(app.js)의 OPENROUTER_API_KEY에 키를 넣거나, [설정 & API 키] 모달에서 입력해주세요.");
    openSettingsModal();
    return;
  }

  const session = getActiveSession();
  if (!session) return;

  // Add User Message
  session.messages.push({ role: 'user', content: text });
  if (session.messages.length === 1) {
    // Generate Title from first query
    session.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
    renderHistoryList();
  }

  appendMessageToUI('user', text);
  elements.userInput.value = '';
  elements.userInput.style.height = 'auto';
  updateCharCount();

  // Prepare UI for Assistant Stream
  const assistantRow = appendMessageToUI('assistant', '');
  const messageBody = assistantRow.querySelector('.message-body');
  messageBody.innerHTML = `<span class="typing-cursor"></span>`;

  setGeneratingState(true);

  // Prepare OpenRouter Request Payload
  const currentModel = elements.modelSelect.value === 'custom' 
    ? elements.customModelInput.value.trim() 
    : elements.modelSelect.value;

  const messagesPayload = [];
  let finalSystemPrompt = state.settings.systemPrompt || "";
  if (state.settings.webSearch) {
    finalSystemPrompt += " (지침: 불확실하거나 최신 정보가 필요한 경우 반드시 웹 검색 도구를 사용하여 검증된 정보를 기반으로 답변하고 할루시네이션을 최소화하세요.)";
  }
  if (finalSystemPrompt) {
    messagesPayload.push({ role: 'system', content: finalSystemPrompt });
  }
  messagesPayload.push(...session.messages);

  state.abortController = new AbortController();

  const requestBody = {
    model: currentModel,
    messages: messagesPayload,
    temperature: state.settings.temperature,
    max_tokens: state.settings.maxTokens,
    stream: state.settings.stream
  };

  if (state.settings.webSearch) {
    requestBody.tools = [{ type: "openrouter:web_search" }];
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${activeApiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Nexus AI Studio",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: state.abortController.signal
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    let fullResponseText = "";

    if (state.settings.stream && response.body) {
      // SSE Streaming Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed === "data: [DONE]") {
            break;
          }

          if (trimmed.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const chunk = parsed.choices?.[0]?.delta?.content || "";
              fullResponseText += chunk;
              messageBody.innerHTML = marked.parse(fullResponseText) + `<span class="typing-cursor"></span>`;
              scrollToBottom();
            } catch (e) {
              console.error("Error parsing SSE line:", e);
            }
          }
        }
      }
    } else {
      // Non-Streaming Response Fallback
      const json = await response.json();
      fullResponseText = json.choices?.[0]?.message?.content || "응답 내용이 없습니다.";
    }

    // Finalize assistant message
    messageBody.innerHTML = marked.parse(fullResponseText);
    session.messages.push({ role: 'assistant', content: fullResponseText });
    saveSessionsToStorage();

  } catch (error) {
    if (error.name === 'AbortError') {
      messageBody.innerHTML = marked.parse(messageBody.innerText + "\n\n*(사용자에 의해 생성 중단됨)*");
    } else {
      console.error("OpenRouter API Error:", error);
      messageBody.innerHTML = `<div style="color: var(--danger);"><i class="fa-solid fa-circle-exclamation"></i> <strong>오류 발생:</strong> ${escapeHtml(error.message)}</div>`;
    }
  } finally {
    setGeneratingState(false);
    state.abortController = null;
  }
}

function setGeneratingState(isGenerating) {
  state.isGenerating = isGenerating;
  if (isGenerating) {
    elements.sendBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
    elements.statusBadge.classList.add('generating');
    elements.statusText.innerText = "답변 생성 중...";
  } else {
    elements.sendBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.statusBadge.classList.remove('generating');
    elements.statusText.innerText = "준비됨";
  }
}

/* ==========================================================================
   Event Handlers & Interactivity
   ========================================================================== */
function initEventListeners() {
  // Sidebar Toggles
  elements.toggleSidebarBtn.onclick = () => elements.sidebar.classList.add('open');
  elements.closeSidebarBtn.onclick = () => elements.sidebar.classList.remove('open');
  
  // New Chat & Clear History
  elements.newChatBtn.onclick = createNewSession;
  elements.clearAllHistoryBtn.onclick = () => {
    if (confirm("모든 대화 기록을 삭제하시겠습니까?")) {
      state.sessions = [];
      localStorage.removeItem("nexus_chat_sessions");
      createNewSession();
    }
  };

  // Model Selector Handler
  elements.modelSelect.onchange = () => {
    if (elements.modelSelect.value === 'custom') {
      elements.customModelBar.classList.remove('hidden');
    } else {
      elements.customModelBar.classList.add('hidden');
    }
    const session = getActiveSession();
    if (session) {
      session.model = elements.modelSelect.value;
      saveSessionsToStorage();
    }
  };

  elements.applyCustomModelBtn.onclick = () => {
    const val = elements.customModelInput.value.trim();
    if (val) {
      alert(`커스텀 모델이 [${val}] 로 지정되었습니다.`);
    }
  };

  // Textarea Input Events
  elements.userInput.oninput = () => {
    // Auto resize
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 180) + 'px';
    updateCharCount();
  };

  elements.userInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  elements.sendBtn.onclick = sendMessage;
  elements.stopBtn.onclick = () => {
    if (state.abortController) {
      state.abortController.abort();
    }
  };

  // Starter Cards Click Handler
  document.querySelectorAll('.starter-card').forEach(card => {
    card.onclick = () => {
      const promptText = card.getAttribute('data-prompt');
      if (promptText) {
        elements.userInput.value = promptText;
        sendMessage();
      }
    };
  });

  // Settings Modal Handlers
  elements.headerSettingsBtn.onclick = openSettingsModal;
  elements.openSettingsBtn.onclick = openSettingsModal;
  elements.closeSettingsModalBtn.onclick = closeSettingsModal;
  elements.cancelSettingsBtn.onclick = closeSettingsModal;
  elements.saveSettingsBtn.onclick = saveSettings;

  elements.toggleApiKeyVisibility.onclick = () => {
    const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
    elements.apiKeyInput.type = type;
    elements.toggleApiKeyVisibility.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
  };

  // System Prompt Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-preset');
      if (PRESETS[key]) {
        elements.systemPromptInput.value = PRESETS[key];
      }
    };
  });

  // Sliders Live Update
  elements.tempSlider.oninput = () => elements.tempVal.innerText = elements.tempSlider.value;
  elements.maxTokensSlider.oninput = () => elements.maxTokensVal.innerText = elements.maxTokensSlider.value;

  // Web Search Toggle Events
  if (elements.webSearchToggleBtn) {
    elements.webSearchToggleBtn.onclick = () => {
      state.settings.webSearch = !state.settings.webSearch;
      localStorage.setItem("nexus_web_search", state.settings.webSearch);
      updateWebSearchUI();
    };
  }

  // Export Chat Handler
  elements.exportChatBtn.onclick = exportChat;
}

function updateWebSearchUI() {
  if (state.settings.webSearch) {
    elements.webSearchToggleBtn?.classList.add('active');
    elements.webSearchToggleBtn.querySelector('span').innerText = '웹 검색 켜짐';
  } else {
    elements.webSearchToggleBtn?.classList.remove('active');
    elements.webSearchToggleBtn.querySelector('span').innerText = '웹 검색 꺼짐';
  }
  if (elements.webSearchModalToggle) {
    elements.webSearchModalToggle.checked = state.settings.webSearch;
  }
}

function updateCharCount() {
  elements.charCount.innerText = elements.userInput.value.length;
}

function syncSettingsUI() {
  elements.apiKeyInput.value = state.settings.apiKey;
  elements.systemPromptInput.value = state.settings.systemPrompt;
  elements.tempSlider.value = state.settings.temperature;
  elements.tempVal.innerText = state.settings.temperature;
  elements.maxTokensSlider.value = state.settings.maxTokens;
  elements.maxTokensVal.innerText = state.settings.maxTokens;
  elements.streamToggle.checked = state.settings.stream;
  if (elements.webSearchModalToggle) {
    elements.webSearchModalToggle.checked = state.settings.webSearch;
  }
  updateWebSearchUI();
}

function openSettingsModal() {
  syncSettingsUI();
  elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  elements.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.settings.apiKey = elements.apiKeyInput.value.trim();
  state.settings.systemPrompt = elements.systemPromptInput.value.trim();
  state.settings.temperature = parseFloat(elements.tempSlider.value);
  state.settings.maxTokens = parseInt(elements.maxTokensSlider.value);
  state.settings.stream = elements.streamToggle.checked;
  if (elements.webSearchModalToggle) {
    state.settings.webSearch = elements.webSearchModalToggle.checked;
  }

  localStorage.setItem("nexus_api_key", state.settings.apiKey);
  localStorage.setItem("nexus_system_prompt", state.settings.systemPrompt);
  localStorage.setItem("nexus_temperature", state.settings.temperature);
  localStorage.setItem("nexus_max_tokens", state.settings.maxTokens);
  localStorage.setItem("nexus_stream", state.settings.stream);
  localStorage.setItem("nexus_web_search", state.settings.webSearch);

  updateWebSearchUI();
  closeSettingsModal();
}

function exportChat() {
  const session = getActiveSession();
  if (!session || session.messages.length === 0) {
    alert("내보낼 대화 내역이 없습니다.");
    return;
  }

  let mdContent = `# ${session.title}\n*생성 일시: ${new Date(session.createdAt).toLocaleString()}*\n*모델: ${session.model}*\n\n---\n\n`;

  session.messages.forEach(msg => {
    const roleName = msg.role === 'user' ? '### 👤 사용자' : '### 🤖 Nexus AI';
    mdContent += `${roleName}\n${msg.content}\n\n`;
  });

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
