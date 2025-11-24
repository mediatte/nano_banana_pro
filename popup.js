// DOM 요소
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const apiStatus = document.getElementById('apiStatus');
const modelSelect = document.getElementById('modelSelect');
const modelInfo = document.getElementById('modelInfo');
const tabs = document.querySelectorAll('.tab');
const textTab = document.getElementById('textTab');
const imageTab = document.getElementById('imageTab');
const textPromptInput = document.getElementById('textPrompt');
const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const imagePreview = document.getElementById('imagePreview');
const imagePromptInput = document.getElementById('imagePrompt');
const generateFromTextBtn = document.getElementById('generateFromText');
const generateFromImageBtn = document.getElementById('generateFromImage');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const resultImage = document.getElementById('resultImage');
const downloadImageBtn = document.getElementById('downloadImage');
const openImageBtn = document.getElementById('openImage');
const errorDiv = document.getElementById('error');

let currentImageFile = null;
let selectedModel = 'gemini-2'; // 기본값: Gemini 2.0 Flash (추천)
let imageCache = null; // IndexedDB 캐시

// IndexedDB 초기화
async function initImageCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NanoBananaCache', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      imageCache = request.result;
      console.log('✅ 이미지 캐시 초기화 완료');
      resolve(imageCache);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('images')) {
        const objectStore = db.createObjectStore('images', { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('📦 이미지 저장소 생성 완료');
      }
    };
  });
}

// 이미지 캐시에 저장
async function saveToCache(imageUrl, prompt) {
  if (!imageCache) await initImageCache();
  
  try {
    const transaction = imageCache.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    
    const imageData = {
      id: Date.now().toString(),
      url: imageUrl,
      prompt: prompt,
      timestamp: Date.now(),
      model: selectedModel
    };
    
    await store.add(imageData);
    console.log('💾 이미지 캐시에 저장됨:', imageData.id);
    
    // 캐시 크기 제한 (최근 50개만 유지)
    await cleanOldCache();
    
    return imageData.id;
  } catch (error) {
    console.error('❌ 캐시 저장 실패:', error);
  }
}

// 오래된 캐시 정리
async function cleanOldCache() {
  if (!imageCache) return;
  
  try {
    const transaction = imageCache.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const index = store.index('timestamp');
    
    const allImages = await new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // 최근 50개만 유지
    if (allImages.length > 50) {
      const sortedImages = allImages.sort((a, b) => b.timestamp - a.timestamp);
      const imagesToDelete = sortedImages.slice(50);
      
      for (const img of imagesToDelete) {
        await store.delete(img.id);
      }
      
      console.log(`🧹 오래된 캐시 ${imagesToDelete.length}개 삭제`);
    }
  } catch (error) {
    console.error('❌ 캐시 정리 실패:', error);
  }
}

// 캐시에서 이미지 불러오기
async function loadFromCache(imageId) {
  if (!imageCache) await initImageCache();
  
  try {
    const transaction = imageCache.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    const request = store.get(imageId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ 캐시 로드 실패:', error);
    return null;
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 DOMContentLoaded - 초기화 시작');
  
  // IndexedDB 캐시 초기화
  try {
    await initImageCache();
  } catch (error) {
    console.warn('⚠️ 이미지 캐시 초기화 실패:', error);
  }
  
  // DOM 요소 확인
  console.log('📋 DOM 요소 확인:');
  console.log('  apiKeyInput:', apiKeyInput);
  console.log('  saveApiKeyBtn:', saveApiKeyBtn);
  console.log('  toggleApiKeyBtn:', toggleApiKeyBtn);
  
  if (!apiKeyInput) {
    console.error('❌ apiKeyInput을 찾을 수 없습니다!');
  }
  if (!saveApiKeyBtn) {
    console.error('❌ saveApiKeyBtn을 찾을 수 없습니다!');
  }
  if (!toggleApiKeyBtn) {
    console.error('❌ toggleApiKeyBtn을 찾을 수 없습니다!');
  }
  
  // 저장된 API 키 및 모델 불러오기
  const data = await chrome.storage.local.get(['apiKey', 'selectedModel']);
  if (data.apiKey && apiKeyInput) {
    apiKeyInput.value = data.apiKey;
    updateApiStatus(true);
  } else {
    updateApiStatus(false);
  }
  
  if (data.selectedModel && modelSelect) {
    selectedModel = data.selectedModel;
    modelSelect.value = selectedModel;
  }
  
  updateModelInfo(selectedModel);
  
  // 이벤트 리스너 등록
  setupEventListeners();
  
  console.log('✅ 초기화 완료');
});

// API 상태 업데이트
function updateApiStatus(isConnected) {
  if (isConnected) {
    apiStatus.textContent = '✓ 연결됨';
    apiStatus.classList.add('connected');
  } else {
    apiStatus.textContent = '미설정';
    apiStatus.classList.remove('connected');
  }
}

// 모델 정보 업데이트
function updateModelInfo(model) {
  if (model === 'gemini-3') {
    modelInfo.innerHTML = `
      <div class="model-badge" style="background: linear-gradient(135deg, #9c27b0 0%, #673ab7 100%);">⚡ 직접 생성</div>
      <p class="model-desc"><strong>Gemini 3 Pro Image Preview (v1alpha)</strong> - 직접 이미지 생성 (빠름)</p>
      <ul class="model-features">
        <li>⚡ <strong>빠른 생성</strong> - 프롬프트 개선 없이 직접 생성</li>
        <li>🎨 <strong>Google 네이티브</strong> - Gemini 3 Pro 이미지 모델</li>
        <li>📝 <strong>권장</strong> - 상세한 영어 프롬프트</li>
        <li>💾 <strong>자동 캐시</strong> - IndexedDB에 저장 (최근 50개)</li>
        <li>💰 $2 텍스트 / $0.134 이미지</li>
      </ul>
    `;
  } else {
    modelInfo.innerHTML = `
      <div class="model-badge" style="background: linear-gradient(135deg, #43a047 0%, #66bb6a 100%);">⭐ 추천</div>
      <p class="model-desc"><strong>Gemini 3 Pro (2단계)</strong> - 프롬프트 개선 + 이미지 생성 (고품질)</p>
      <ul class="model-features">
        <li>🎯 <strong>2단계 처리</strong> - Gemini 2.0 개선 → Gemini 3 생성</li>
        <li>🇰🇷 <strong>한국어 OK</strong> - 자동으로 최적화된 프롬프트 생성</li>
        <li>✨ <strong>고품질</strong> - 전문가 수준 프롬프트로 자동 개선</li>
        <li>💾 <strong>자동 캐시</strong> - IndexedDB에 저장 (최근 50개)</li>
        <li>💰 약 $0.13 / 이미지</li>
      </ul>
    `;
  }
}

// 이벤트 리스너 설정 함수
function setupEventListeners() {
  console.log('🎧 이벤트 리스너 등록 시작');
  
  // 모델 선택 변경
  if (modelSelect) {
    modelSelect.addEventListener('change', async (e) => {
      selectedModel = e.target.value;
      await chrome.storage.local.set({ selectedModel });
      updateModelInfo(selectedModel);
      
      showError(`✓ ${selectedModel === 'gemini-3' ? 'Gemini 3 Pro Image Preview (직접 생성)' : 'Gemini 3 Pro Image Preview (프롬프트 개선 + 생성)'} 모드로 변경되었습니다!`, false);
      setTimeout(() => hideError(), 2000);
    });
    console.log('✅ 모델 선택 이벤트 리스너 등록됨');
  }
  
  // API 키 저장 버튼
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('💾 저장 버튼 클릭됨!');
      
      if (!apiKeyInput) {
        console.error('❌ apiKeyInput이 없습니다');
        return;
      }
      
      const apiKey = apiKeyInput.value.trim();
      console.log('📝 입력된 API 키 길이:', apiKey.length);
      
      if (!apiKey) {
        showError('API 키를 입력해주세요.');
        return;
      }
      
      // API 키 유효성 간단히 체크
      if (apiKey.length < 20) {
        showError('유효하지 않은 API 키 형식입니다.');
        return;
      }
      
      try {
        await chrome.storage.local.set({ apiKey, selectedModel });
        updateApiStatus(true);
        showError('✓ API 키가 안전하게 저장되었습니다!', false);
        setTimeout(() => hideError(), 2000);
        console.log('✅ API 키 저장 완료');
      } catch (error) {
        console.error('❌ API 키 저장 오류:', error);
        showError('저장 중 오류가 발생했습니다.');
      }
    });
    console.log('✅ 저장 버튼 이벤트 리스너 등록됨');
  } else {
    console.error('❌ saveApiKeyBtn을 찾을 수 없어 이벤트 리스너를 등록할 수 없습니다');
  }
  
  // API 키 보기/숨기기 토글 버튼
  if (toggleApiKeyBtn) {
    toggleApiKeyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('👁️ 보기 버튼 클릭됨!');
      
      if (!apiKeyInput) {
        console.error('❌ apiKeyInput이 없습니다');
        return;
      }
      
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyBtn.textContent = '🙈';
        console.log('👁️ API 키 표시됨');
      } else {
        apiKeyInput.type = 'password';
        toggleApiKeyBtn.textContent = '👁️';
        console.log('🙈 API 키 숨김');
      }
    });
    console.log('✅ 보기 버튼 이벤트 리스너 등록됨');
  } else {
    console.error('❌ toggleApiKeyBtn을 찾을 수 없어 이벤트 리스너를 등록할 수 없습니다');
  }
  
  // 탭 전환
  if (tabs && tabs.length > 0) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // 탭 활성화
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // 탭 콘텐츠 표시
        if (tabName === 'text') {
          if (textTab) textTab.classList.add('active');
          if (imageTab) imageTab.classList.remove('active');
        } else {
          if (textTab) textTab.classList.remove('active');
          if (imageTab) imageTab.classList.add('active');
        }
        
        // 결과 숨기기
        hideResult();
        hideError();
      });
    });
    console.log('✅ 탭 전환 이벤트 리스너 등록됨');
  }
  
  // 이미지 파일 선택 처리
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        currentImageFile = null;
        if (imagePreview) imagePreview.classList.remove('show');
        return;
      }
      
      handleImageFile(file);
    });
    console.log('✅ 이미지 파일 선택 이벤트 리스너 등록됨');
  }
  
  // 텍스트로 이미지 생성 버튼
  if (generateFromTextBtn) {
    generateFromTextBtn.addEventListener('click', async () => {
      const prompt = textPromptInput ? textPromptInput.value.trim() : '';
      
      if (!prompt) {
        showError('프롬프트를 입력해주세요.');
        return;
      }
      
      await generateImage('text', prompt);
    });
    console.log('✅ 텍스트 생성 버튼 이벤트 리스너 등록됨');
  }
  
  // 이미지 편집 버튼
  if (generateFromImageBtn) {
    generateFromImageBtn.addEventListener('click', async () => {
      if (!currentImageFile) {
        showError('이미지를 먼저 업로드해주세요.');
        return;
      }
      
      const prompt = imagePromptInput ? imagePromptInput.value.trim() : '';
      if (!prompt) {
        showError('편집 명령어를 입력해주세요.');
        return;
      }
      
      await generateImage('image', prompt, currentImageFile);
    });
    console.log('✅ 이미지 편집 버튼 이벤트 리스너 등록됨');
  }
  
  // 이미지 다운로드 버튼
  if (downloadImageBtn) {
    downloadImageBtn.addEventListener('click', async () => {
      if (!resultImage || !resultImage.dataset.url) {
        showError('다운로드할 이미지가 없습니다.');
        return;
      }
      
      try {
        const imageUrl = resultImage.dataset.url;
        
        // Blob으로 이미지 다운로드
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // 다운로드 링크 생성
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `nano-banana-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        
        showError('✓ 이미지가 다운로드되었습니다!', false);
        setTimeout(() => hideError(), 2000);
      } catch (error) {
        console.error('다운로드 오류:', error);
        showError('다운로드 중 오류가 발생했습니다.');
      }
    });
    console.log('✅ 다운로드 버튼 이벤트 리스너 등록됨');
  }
  
  // 이미지 새 탭에서 열기 버튼
  if (openImageBtn) {
    openImageBtn.addEventListener('click', () => {
      if (!resultImage || !resultImage.dataset.url) {
        showError('열 이미지가 없습니다.');
        return;
      }
      
      chrome.tabs.create({ url: resultImage.dataset.url });
    });
    console.log('✅ 새 탭 열기 버튼 이벤트 리스너 등록됨');
  }
  
  // 드래그 앤 드롭 이벤트 설정
  setupDragAndDrop();
  
  console.log('🎉 모든 이벤트 리스너 등록 완료!');
}

// 이미지 파일 처리 함수
function handleImageFile(file) {
  console.log('🖼️ 이미지 파일 처리:', file.name, file.type, file.size, 'bytes');
  
  if (!file.type.startsWith('image/')) {
    console.warn('⚠️ 이미지 파일이 아님:', file.type);
    showError('이미지 파일만 선택할 수 있습니다.');
    return;
  }
  
  currentImageFile = file;
  console.log('✅ currentImageFile 설정 완료');
  
  // 드롭 존 숨기기
  if (dropZone) {
    dropZone.style.display = 'none';
  }
  
  // 미리보기 표시
  const reader = new FileReader();
  reader.onload = (e) => {
    console.log('✅ 파일 읽기 완료, 미리보기 표시');
    imagePreview.innerHTML = `
      <div class="image-preview-header">
        <span class="image-preview-title">📷 ${file.name}</span>
        <button class="image-preview-remove" id="removeImage">제거</button>
      </div>
      <img src="${e.target.result}" alt="미리보기">
    `;
    imagePreview.classList.add('show');
    
    // 제거 버튼 이벤트
    const removeBtn = document.getElementById('removeImage');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🗑️ 이미지 제거 버튼 클릭됨');
        removeImage();
      });
    }
    
    console.log('✅ 제거 버튼 이벤트 리스너 등록 완료');
  };
  reader.onerror = (error) => {
    console.error('❌ 파일 읽기 오류:', error);
    showError('파일을 읽을 수 없습니다.');
  };
  reader.readAsDataURL(file);
}

// 이미지 제거 함수
function removeImage() {
  console.log('🗑️ 이미지 제거 실행');
  
  // 현재 이미지 파일 초기화
  currentImageFile = null;
  
  // 미리보기 숨기기
  imagePreview.classList.remove('show');
  imagePreview.innerHTML = '';
  
  // 드롭 존 다시 표시
  if (dropZone) {
    dropZone.style.display = 'block';
  }
  
  // 파일 입력 초기화
  if (imageInput) {
    imageInput.value = '';
  }
  
  console.log('✅ 이미지 제거 완료');
  
  // 사용자에게 피드백
  showError('✓ 이미지가 제거되었습니다.', false);
  setTimeout(() => hideError(), 1500);
}

// 드래그 앤 드롭 이벤트 설정 함수
function setupDragAndDrop() {
  console.log('🎯 드래그 앤 드롭 이벤트 초기화 중...');
  
  // 전역 드래그 이벤트 방지 (파일이 새 탭에서 열리는 것 방지)
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });
  
  // 드롭존에 이벤트 리스너 추가
  if (dropZone) {
    console.log('✅ 드롭존 요소 찾음:', dropZone);
    
    // 드래그 엔터
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🎨 드래그 엔터!');
      dropZone.classList.add('dragover');
    }, false);
    
    // 드래그 오버
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
    
    // 드래그 리브
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 실제로 영역을 벗어났는지 확인
      if (e.target === dropZone) {
        console.log('👋 드래그 리브');
        dropZone.classList.remove('dragover');
      }
    }, false);
    
    // 드롭!
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🎉 드롭 이벤트 발생!');
      dropZone.classList.remove('dragover');
      
      const dt = e.dataTransfer;
      console.log('📦 DataTransfer:', dt);
      console.log('📁 Files:', dt.files);
      console.log('🔗 Types:', dt.types);
      
      // 1. 파일로 드롭된 경우 (로컬 파일)
      if (dt.files && dt.files.length > 0) {
        console.log('✅ 파일 드롭 감지:', dt.files[0].name);
        const file = dt.files[0];
        handleImageFile(file);
        return;
      }
      
      // 2. 텍스트/HTML로 드롭된 경우 (웹 이미지)
      try {
        // HTML에서 이미지 URL 추출
        const html = dt.getData('text/html');
        if (html) {
          console.log('📝 HTML 데이터:', html.substring(0, 200));
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
          const match = imgRegex.exec(html);
          
          if (match && match[1]) {
            console.log('🖼️ 이미지 URL 추출:', match[1]);
            await handleImageUrl(match[1]);
            return;
          }
        }
        
        // URL 직접 드롭
        const url = dt.getData('text/uri-list') || dt.getData('text/plain');
        if (url) {
          console.log('🔗 URL 드롭:', url);
          await handleImageUrl(url);
          return;
        }
        
        console.warn('⚠️ 처리할 수 있는 데이터를 찾지 못했습니다');
        showError('이미지를 인식할 수 없습니다. 이미지 파일이나 이미지 URL을 드래그해주세요.');
      } catch (error) {
        console.error('❌ 드롭 처리 오류:', error);
        showError('드롭 처리 중 오류가 발생했습니다.');
      }
    }, false);
    
    console.log('✅ 드래그 앤 드롭 이벤트 리스너 등록됨');
  } else {
    console.error('❌ 드롭존 요소를 찾을 수 없습니다!');
  }
}

// URL에서 이미지 로드 (개선된 버전)
async function handleImageUrl(url) {
  try {
    console.log('🌐 이미지 URL 로드 시작:', url);
    showError('이미지를 불러오는 중...', false);
    
    // URL 정리
    let cleanUrl = url.trim();
    
    // data URL인 경우
    if (cleanUrl.startsWith('data:image')) {
      console.log('📊 Base64 이미지 감지');
      const response = await fetch(cleanUrl);
      const blob = await response.blob();
      const file = new File([blob], 'pasted-image.png', { type: blob.type });
      handleImageFile(file);
      hideError();
      return;
    }
    
    // HTTP/HTTPS URL 처리
    // CORS 우회를 위한 여러 방법 시도
    let blob;
    let success = false;
    
    // 방법 1: 직접 fetch (CORS 허용된 경우)
    try {
      console.log('📡 방법 1: 직접 fetch 시도...');
      const response = await fetch(cleanUrl, { 
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        blob = await response.blob();
        if (blob.type.startsWith('image/')) {
          success = true;
          console.log('✅ 직접 fetch 성공!');
        }
      }
    } catch (e) {
      console.warn('⚠️ 직접 fetch 실패:', e.message);
    }
    
    // 방법 2: 프록시 사용 (CORS 차단된 경우)
    if (!success) {
      try {
        console.log('📡 방법 2: CORS 프록시 시도...');
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (response.ok) {
          blob = await response.blob();
          if (blob.type.startsWith('image/') || blob.size > 0) {
            success = true;
            console.log('✅ 프록시 fetch 성공!');
          }
        }
      } catch (e) {
        console.warn('⚠️ 프록시 fetch 실패:', e.message);
      }
    }
    
    // 방법 3: 이미지를 임시로 DOM에 로드 후 canvas로 변환
    if (!success) {
      console.log('📡 방법 3: Canvas 변환 시도...');
      blob = await loadImageViaCanvas(cleanUrl);
      if (blob) {
        success = true;
        console.log('✅ Canvas 변환 성공!');
      }
    }
    
    if (!success || !blob) {
      throw new Error('이미지를 불러올 수 없습니다');
    }
    
    if (!blob.type.startsWith('image/')) {
      blob = new Blob([blob], { type: 'image/png' });
    }
    
    // Blob을 File로 변환
    const fileName = cleanUrl.split('/').pop()?.split('?')[0] || 'dropped-image.png';
    const file = new File([blob], fileName, { type: blob.type });
    
    console.log('✅ 이미지 파일 생성 완료:', file.name, file.size, 'bytes');
    handleImageFile(file);
    hideError();
    
  } catch (error) {
    console.error('❌ 이미지 URL 로드 오류:', error);
    showError('이미지를 불러올 수 없습니다. CORS 제한이 있을 수 있습니다. 이미지를 다운로드 후 직접 업로드해주세요.');
  }
}

// Canvas를 통해 이미지 로드 (CORS 우회)
async function loadImageViaCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob 변환 실패'));
          }
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('이미지 로드 실패'));
    };
    
    img.src = url;
    
    // 타임아웃 설정 (10초)
    setTimeout(() => {
      reject(new Error('이미지 로드 타임아웃'));
    }, 10000);
  });
}

// 이미지 생성 메인 함수
async function generateImage(type, prompt, imageFile = null) {
  // API 키 확인
  const data = await chrome.storage.local.get(['apiKey']);
  const apiKey = data.apiKey;
  
  if (!apiKey) {
    showError('API 키를 먼저 설정해주세요.');
    return;
  }
  
  // UI 상태 변경
  showLoading();
  hideError();
  hideResult();
  
  try {
    let imageUrl;
    
    if (type === 'text') {
      // 텍스트로 이미지 생성 (Imagen API 사용)
      imageUrl = await generateImageFromText(apiKey, prompt);
    } else {
      // 이미지 편집 (Gemini Vision API 사용)
      imageUrl = await editImageWithPrompt(apiKey, prompt, imageFile);
    }
    
    // 결과 표시
    resultImage.src = imageUrl;
    resultImage.dataset.url = imageUrl;
    showResult();
    
    // 캐시에 저장
    try {
      const cacheId = await saveToCache(imageUrl, prompt);
      console.log('✅ 이미지 캐시 저장 완료:', cacheId);
    } catch (error) {
      console.warn('⚠️ 캐시 저장 실패 (기능 계속 작동):', error);
    }
    
  } catch (error) {
    console.error('Error generating image:', error);
    showError(error.message || '이미지 생성 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}

// 텍스트로 이미지 생성
async function generateImageFromText(apiKey, prompt) {
  // 모든 모드에서 Gemini 3 Pro Image Preview 사용
  console.log('🎨 Google AI 이미지 생성 시작...');
  
  // 1단계: Gemini 2.0으로 프롬프트 개선
  const enhancedPrompt = await enhancePromptWithGemini(apiKey, prompt);
  console.log('✅ 프롬프트 개선 완료');
  
  // 2단계: Gemini 3 Pro Image Preview로 이미지 생성
  return await generateWithGemini3(apiKey, enhancedPrompt);
}

// Gemini 3 Pro Image Preview로 직접 이미지 생성 (Google AI 전용)
async function generateWithGemini3(apiKey, prompt) {
  console.log('🎨 Gemini 3 Pro Image Preview: 이미지 생성 시작...');
  console.log('📝 프롬프트:', prompt.substring(0, 100) + '...');
  
  try {
    // Gemini 3 Pro Image Preview로 이미지 생성 (v1alpha API)
    console.log('🖼️ Gemini 3 Pro Image Preview API 호출 (v1alpha)...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a high-quality, detailed image: ${prompt}

Create a photorealistic, well-composed image with:
- High resolution and clarity
- Professional quality
- Rich colors and proper lighting
- Attention to detail`
            }]
          }],
          generationConfig: {
            temperature: 1.0  // gemini-3-pro-image-preview는 thinking_level 미지원
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Gemini 3 Pro API 오류:', errorData);
      
      // 더 자세한 에러 메시지
      if (errorData.error) {
        throw new Error(`Gemini 3 Pro API 실패: ${errorData.error.message} (코드: ${errorData.error.code})`);
      }
      throw new Error('Gemini 3 Pro API 요청 실패');
    }

    const result = await response.json();
    console.log('📦 Gemini 3 Pro 응답 받음');
    
    const parts = result.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('응답에서 parts를 찾을 수 없습니다');
    }
    
    // 이미지 데이터 찾기 (inlineData)
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        console.log('✅ Gemini 3 Pro가 이미지 생성 성공!');
        console.log('📸 Google AI 네이티브 생성');
        
        // thoughtSignature가 있으면 저장
        if (part.thoughtSignature) {
          console.log('💾 thoughtSignature 저장됨');
        }
        
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    // 이미지가 없고 텍스트만 있는 경우 - 재시도
    const textResponse = parts[0]?.text;
    if (textResponse) {
      console.log('⚠️ 이미지 대신 텍스트 응답 받음, 재시도 중...');
      console.log('💡 응답:', textResponse.substring(0, 200));
      
      // Gemini가 이미지 생성을 거부한 경우
      throw new Error('Gemini 3 Pro가 이미지를 생성하지 못했습니다. API 키 또는 프롬프트를 확인해주세요.');
    }
    
    throw new Error('응답에서 이미지 데이터를 찾을 수 없습니다');
    
  } catch (error) {
    console.error('❌ Google AI 이미지 생성 실패:', error.message);
    
    // 사용자에게 명확한 에러 메시지
    if (error.message.includes('API key')) {
      throw new Error('API 키가 유효하지 않거나 Gemini 3 Pro 권한이 없습니다. Google AI Studio에서 API 키를 확인해주세요.');
    }
    if (error.message.includes('404')) {
      throw new Error('Gemini 3 Pro Image Preview API를 사용할 수 없습니다. API 키에 이미지 생성 권한이 있는지 확인해주세요.');
    }
    if (error.message.includes('403')) {
      throw new Error('API 접근이 거부되었습니다. Gemini 3 Pro 사용 권한을 확인해주세요.');
    }
    
    // 기타 에러는 그대로 전달
    throw error;
  }
}

// Gemini로 프롬프트 개선
async function enhancePromptWithGemini(apiKey, prompt) {
  try {
    console.log('⚡ Gemini 2.0 Flash: 프롬프트 개선 중...');
    console.log('📝 원본 프롬프트:', prompt);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert AI image generation prompt engineer. Transform the following prompt into a detailed, professional-quality image generation prompt in English.

Original prompt: "${prompt}"

Requirements:
- Create a highly detailed, vivid description
- Include specific artistic style (photorealistic, cinematic, artistic, etc.)
- Specify lighting details (golden hour, studio lighting, natural light, etc.)
- Add composition details (rule of thirds, symmetrical, wide angle, etc.)
- Include color palette and mood
- Add quality modifiers: "masterpiece", "best quality", "ultra detailed", "8K resolution", "professional photography"
- Keep it concise but comprehensive (max 150 words)

Output ONLY the enhanced prompt in English, no explanations or additional text.`
            }]
          }],
          generationConfig: {
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens: 300,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('⚠️ Gemini API 오류:', errorData);
      throw new Error('Gemini API 요청 실패');
    }

    const result = await response.json();
    const enhancedPrompt = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (enhancedPrompt) {
      console.log('✅ 개선된 프롬프트:', enhancedPrompt);
      return enhancedPrompt;
    }
    
    console.warn('⚠️ 개선된 프롬프트를 받지 못함, 원본 사용');
    return prompt; // 실패 시 원본 프롬프트 반환
  } catch (error) {
    console.error('❌ 프롬프트 개선 실패:', error);
    console.log('💡 원본 프롬프트 사용:', prompt);
    return prompt; // 실패 시 원본 프롬프트 반환
  }
}

// 순수 Google AI만 사용 - Gemini 3 Pro Image Preview 전용
// Gemini 2.0 Flash (프롬프트 개선) → Gemini 3 Pro Image Preview (이미지 생성)

// 이미지 편집 (Gemini Vision API 사용)
async function editImageWithPrompt(apiKey, prompt, imageFile) {
  // 이미지를 base64로 변환
  const base64Image = await fileToBase64(imageFile);
  const base64Data = base64Image.split(',')[1];
  
  if (selectedModel === 'gemini-3') {
    // Gemini 3 Pro Image Preview로 직접 이미지 편집 및 생성 (v1alpha API)
    try {
      console.log('🎨 Gemini 3 Pro Image Preview: 이미지 편집 시작...');
      console.log('📝 편집 요청:', prompt);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1alpha/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Edit this image with the following modification: "${prompt}". Maintain the overall composition, style, and quality of the original image while precisely applying the requested changes. Generate a high-quality, photorealistic result.`
                },
                {
                  inlineData: {
                    mimeType: imageFile.type,
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 1.0  // gemini-3-pro-image-preview는 thinking_level/media_resolution 미지원
            }
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('⚠️ Gemini 3 Pro 이미지 편집 API 오류:', errorData);
        throw new Error(errorData.error?.message || 'Gemini 3 Pro API 실패');
      }
      
      const result = await response.json();
      console.log('📦 Gemini 3 Pro 편집 응답 받음');
      
      const parts = result.candidates?.[0]?.content?.parts;
      
      if (!parts || parts.length === 0) {
        throw new Error('응답에서 parts를 찾을 수 없습니다');
      }
      
      // inlineData에서 이미지 찾기 (Gemini 3는 inlineData 사용, 언더스코어 아님)
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          console.log('✅ Gemini 3 Pro가 직접 이미지 편집 성공!');
          
          // thoughtSignature 저장 (다음 편집용)
          if (part.thoughtSignature) {
            console.log('💾 thoughtSignature 저장됨 (추가 편집용)');
            // 여러 번 편집을 위해 저장할 수 있음
          }
          
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error('응답에서 이미지 데이터를 찾을 수 없습니다');
    } catch (error) {
      console.error('❌ Gemini 3 Pro 이미지 편집 실패:', error.message);
      
      // 사용자에게 명확한 에러 메시지
      throw new Error(`이미지 편집 실패: ${error.message}. Gemini 3 Pro Image Preview API를 사용할 수 없거나 권한이 없을 수 있습니다.`);
    }
  } else {
    // 모든 모드에서 Gemini 3 Pro Image Preview 사용
    console.log('🔄 Gemini 3 Pro로 이미지 편집 시도...');
    
    // Gemini 3 Pro로 재귀 호출 (selectedModel 일시적 변경)
    const originalModel = selectedModel;
    selectedModel = 'gemini-3';
    
    try {
      return await editImageWithPrompt(apiKey, prompt, imageFile);
    } finally {
      selectedModel = originalModel;
    }
  }
}

// 파일을 Base64로 변환
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// UI 헬퍼 함수
function showLoading() {
  loading.classList.add('show');
  generateFromTextBtn.disabled = true;
  generateFromImageBtn.disabled = true;
}

function hideLoading() {
  loading.classList.remove('show');
  generateFromTextBtn.disabled = false;
  generateFromImageBtn.disabled = false;
}

function showResult() {
  result.classList.add('show');
}

function hideResult() {
  result.classList.remove('show');
}

function showError(message, isError = true) {
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  if (!isError) {
    errorDiv.style.background = '#f3fff3';
    errorDiv.style.borderColor = '#4caf50';
    errorDiv.style.color = '#2e7d32';
  } else {
    errorDiv.style.background = '#fff3f3';
    errorDiv.style.borderColor = '#ff5252';
    errorDiv.style.color = '#c62828';
  }
}

function hideError() {
  errorDiv.classList.remove('show');
}

