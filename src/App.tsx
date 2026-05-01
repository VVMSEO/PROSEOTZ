import { useState, useEffect, useRef } from 'react';
import { Target, ClipboardList, Search, Wrench, Rocket, Copy, Download, Loader2, Settings, X } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const PROBLEM_TYPES = [
  { id: 'duplicate', name: 'Дублирование контента', desc: 'Размытие ссылочного веса' },
  { id: 'crawl', name: 'Краулинговый бюджет', desc: 'Неэффективное сканирование' },
  { id: 'cannibalization', name: 'Каннибализация запросов', desc: 'Конкуренция страниц' },
  { id: 'ux', name: 'Пользовательский опыт', desc: 'Плохая навигация/структура' },
  { id: 'indexing', name: 'Проблемы индексации', desc: 'Неправильная индексация' },
  { id: 'technical', name: 'Технические проблемы', desc: 'Скорость, структура, коды' },
];

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  
  // State
  const [siteName, setSiteName] = useState('');
  const [taskSummary, setTaskSummary] = useState('');
  const [selectedProblemType, setSelectedProblemType] = useState<string | null>(null);
  const [problemDescription, setProblemDescription] = useState('');
  const [exampleUrls, setExampleUrls] = useState('');
  const [businessGoal, setBusinessGoal] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [cmsFramework, setCmsFramework] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState('');
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('router_api_key') || '');

  const isInitialLoad = useRef(true);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Login failed", e);
      showToast("Ошибка при входе", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      console.error("Logout failed", e);
    }
  };

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load from Firestore
  useEffect(() => {
    if (!userId) return;
    
    const path = `users/${userId}/formData/main`;
    const docRef = doc(db, path);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSiteName(data.siteName || '');
        setTaskSummary(data.taskSummary || '');
        setSelectedProblemType(data.selectedProblemType || null);
        setProblemDescription(data.problemDescription || '');
        setExampleUrls(data.exampleUrls || '');
        setBusinessGoal(data.businessGoal || '');
        setAdditionalDetails(data.additionalDetails || '');
        setCmsFramework(data.cmsFramework || '');
      }
      isInitialLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    
    return () => unsubscribe();
  }, [userId]);

  // Save to Firestore on change
  useEffect(() => {
    if (!userId || isInitialLoad.current) return;

    const t = setTimeout(() => {
      const path = `users/${userId}/formData/main`;
      const data = {
        siteName,
        taskSummary,
        selectedProblemType: selectedProblemType || '',
        problemDescription,
        exampleUrls,
        businessGoal,
        additionalDetails,
        cmsFramework,
      };
      setDoc(doc(db, path), data, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    }, 1000);

    return () => clearTimeout(t);
  }, [siteName, taskSummary, selectedProblemType, problemDescription, exampleUrls, businessGoal, additionalDetails, cmsFramework, userId]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Save API key to LocalStorage
  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('router_api_key', key);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      showToast('Пожалуйста, укажите API ключ в настройках', 'error');
      setIsSettingsOpen(true);
      return;
    }
    if (!siteName.trim() || !taskSummary.trim() || !problemDescription.trim()) {
      showToast('Пожалуйста, заполните поля: Название сайта, Суть и Описание проблемы.', 'error');
      return;
    }
    if (!selectedProblemType) {
      showToast('Пожалуйста, выберите тип проблемы', 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratedTask('Пожалуйста, подождите, AI составляет техническое задание...');

    const problemTypeName = PROBLEM_TYPES.find(p => p.id === selectedProblemType)?.name || '';

    const prompt = `
Ты — Senior Technical SEO и системный аналитик. Твоя цель — написать идеальное техническое задание (ТЗ) для разработчика. ТЗ должно быть максимально коротким, точным, без "воды", маркетинговых отступлений и общих фраз. Только сухая выжимка и конкретные инструкции. Формат — Markdown.

ВАЖНОЕ ПРАВИЛО ФОРМАТИРОВАНИЯ: НЕ используй символ обратной кавычки (backtick, \`) для выделения доменов, URL-адресов или названий сайтов. Пиши их обычным текстом, чтобы разработчикам было их удобно копировать двойным кликом.

Учти следующие вводные:
- Сайт: ${siteName.trim()}
- CMS/Фреймворк: ${cmsFramework.trim() || 'Кастомная сборка'}
- Задача (кратко): ${taskSummary.trim()}
- Тип проблемы: ${problemTypeName}
- Описание проблемы: ${problemDescription.trim()}
- URL-адреса для проверки:
${exampleUrls.trim() || 'Не указаны'}
- Бизнес-цель: ${businessGoal.trim() || 'Не указана'}
- Дополнительные детали: ${additionalDetails.trim() || 'Нет'}

Структура ТЗ жестко регламентирована:

# ТЗ: ${taskSummary.trim()}

**Контекст задачи**
[Кратко в 1-2 предложениях: в чем проблема и почему это ломает SEO.]

**Стек / Платформа**
${cmsFramework.trim() || 'Не указано (уточнить у лида)'}

---

## 🛑 Что не так на сайте?
- [Опиши, как система работает сейчас (на основе описания: "${problemDescription.trim()}"), что именно отдается в коде или заголовках, что видит поисковый бот. Без эмоций.]

## ✅ Что нужно сделать
- [Опиши, как система должна работать после правок. Какой должен быть статус-код, тег, JSON-LD, редирект и т.д.]

---

## 🛠 Пошаговый план внедрения
[Предоставь детализированный технический алгоритм работы для программиста. Пиши на языке разработчика (бэкенд/фронтенд).]
1. [Конкретный шаг, например: В контроллере X изменить логику отдачи заголовка Y]
2. ...

## 🧪 Критерии приемки (DoD)
- [ ] Однозначные чек-листы для QA/тестирования (например: "URL X отдает статус 200", "В исходном коде присутствует тег Y").

*Срок реализации:* [Укажи разумный срок в часах]
*Приоритет:* [Укажи приоритет на основе задачи]
`;

    try {
      const response = await fetch("https://routerai.ru/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4.6",
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      
      if (text) {
        setGeneratedTask(text);
        showToast('ТЗ успешно сгенерировано!', 'success');
      } else {
        throw new Error('Empty response from AI');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      setGeneratedTask(`Произошла ошибка при генерации ТЗ: ${error.message}\n\nПожалуйста, попробуйте еще раз.`);
      showToast('Ошибка генерации ТЗ', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedTask) return;
    try {
      await navigator.clipboard.writeText(generatedTask);
      showToast('ТЗ скопировано в буфер обмена!', 'success');
    } catch (err) {
      console.error('Copy failed', err);
      showToast('Ошибка при копировании', 'error');
    }
  };

  const handleDownload = () => {
    if (!generatedTask) return;
    const filename = `SEO_TZ_${siteName.replace(/[^a-zA-Z0-9]/g, '_') || 'task'}.md`;
    const blob = new Blob([generatedTask], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Файл успешно скачан!', 'success');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 font-sans text-slate-800 selection:bg-blue-200">
      {/* Header */}
      <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-3 font-bold text-[18px] tracking-tight text-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-sm">SEO</div>
          Pro SEO ТЗ Генератор
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Настройки API"
          >
            <Settings className="w-5 h-5" />
          </button>
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide">Drafting Mode</span>
          {userId ? (
            <button onClick={handleLogout} className="text-sm font-medium hover:text-blue-600 transition-colors">Выйти</button>
          ) : (
            <button onClick={handleLogin} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Войти через Google</button>
          )}
          <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-300 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-500">
            {userId ? auth.currentUser?.email?.[0].toUpperCase() : '?'}
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] overflow-hidden">
        {/* Left Column - Form */}
        <aside className="bg-white border-r border-slate-200 p-6 overflow-y-auto flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="siteName" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Название сайта</label>
            <input
              type="text"
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              placeholder="example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="taskSummary" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Суть задачи (кратко)</label>
            <input
              type="text"
              id="taskSummary"
              value={taskSummary}
              onChange={(e) => setTaskSummary(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              placeholder="Устранение дублей страниц"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cmsFramework" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">CMS / Фреймворк</label>
            <input
              type="text"
              id="cmsFramework"
              value={cmsFramework}
              onChange={(e) => setCmsFramework(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              placeholder="Кастомная, 1С-Битрикс, Next.js и т.д."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Тип SEO проблемы</label>
            <div className="grid grid-cols-1 gap-2">
              {PROBLEM_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedProblemType(type.id)}
                  className={`text-left p-3 rounded-md border transition-colors ${
                    selectedProblemType === type.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 bg-[#fafafa] hover:border-blue-300 hover:bg-white'
                  }`}
                >
                  <div className="font-semibold text-slate-800 text-sm mb-0.5">{type.name}</div>
                  <div className="text-xs text-slate-500">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="problemDescription" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Описание проблемы</label>
            <textarea
              id="problemDescription"
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-y min-h-[80px]"
              placeholder="Опишите проблему подробно..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="exampleUrls" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Примеры URL</label>
            <textarea
              id="exampleUrls"
              value={exampleUrls}
              onChange={(e) => setExampleUrls(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-y min-h-[80px]"
              placeholder="https://example.com/page1&#10;https://example.com/page2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessGoal" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Бизнес-цель</label>
            <textarea
              id="businessGoal"
              value={businessGoal}
              onChange={(e) => setBusinessGoal(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-y min-h-[80px]"
              placeholder="Какую бизнес-цель решает эта задача?"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="additionalDetails" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Дополнительные детали</label>
            <textarea
              id="additionalDetails"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-y min-h-[80px]"
              placeholder="Любые дополнительные детали или контекст..."
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-blue-600 text-white border-none p-3.5 rounded-md font-semibold text-sm cursor-pointer mt-2 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {isGenerating ? 'Генерация...' : 'Сгенерировать Markdown ТЗ'}
          </button>
        </aside>

        {/* Right Column - Result */}
        <section className="bg-[#fdfdfd] p-6 sm:p-10 overflow-y-auto flex flex-col items-center">
          <div className="w-full max-w-[700px] bg-white border border-slate-200 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.03)] p-8 sm:p-12 flex flex-col min-h-full">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div className="flex gap-4 items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  ТЗ
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-md text-xs font-medium">
                  <button
                     onClick={() => setIsPreviewMode(false)}
                     className={`px-3 py-1 rounded transition-colors ${!isPreviewMode ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >Markdown</button>
                  <button
                     onClick={() => setIsPreviewMode(true)}
                     className={`px-3 py-1 rounded transition-colors ${isPreviewMode ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >Preview</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!generatedTask || isGenerating}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-3.5 h-3.5" /> Копировать
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!generatedTask || isGenerating}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" /> Скачать
                </button>
              </div>
            </div>
            {isPreviewMode ? (
              <div className="w-full flex-1 overflow-y-auto prose prose-slate prose-sm max-w-none prose-headings:text-slate-800 prose-a:text-blue-600 prose-pre:bg-slate-50 prose-pre:text-slate-800 prose-pre:border prose-pre:border-slate-200 prose-ul:my-2 prose-li:my-0.5">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {generatedTask || '*Здесь появится сгенерированное AI техническое задание...*'}
                </Markdown>
              </div>
            ) : (
              <textarea
                value={generatedTask}
                readOnly
                className="w-full flex-1 focus:outline-none text-[#334155] font-mono text-sm leading-[1.6] resize-y bg-transparent min-h-[500px]"
                placeholder="Здесь появится сгенерированное AI техническое задание..."
              />
            )}
          </div>
        </section>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-md shadow-lg text-white text-sm font-medium z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 ${
            toast.type === 'success' ? 'bg-emerald-600' :
            toast.type === 'error' ? 'bg-rose-600' :
            'bg-blue-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Настройки API</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="apiKey" className="text-xs font-semibold uppercase tracking-wider text-slate-500">RouterAI API Ключ</label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:border-blue-600 transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Мы сохраняем ваш ключ локально в браузере. Ключ не отправляется на наши серверы и используется только для запросов к API RouterAI.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold text-sm transition-colors"
              >
                Сохранить и Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
