import { useState, useEffect } from 'react';
import { Target, ClipboardList, Search, Wrench, Rocket, Copy, Download, Loader2 } from 'lucide-react';

const PROBLEM_TYPES = [
  { id: 'duplicate', name: 'Дублирование контента', desc: 'Размытие ссылочного веса' },
  { id: 'crawl', name: 'Краулинговый бюджет', desc: 'Неэффективное сканирование' },
  { id: 'cannibalization', name: 'Каннибализация запросов', desc: 'Конкуренция страниц' },
  { id: 'ux', name: 'Пользовательский опыт', desc: 'Плохая навигация/структура' },
  { id: 'indexing', name: 'Проблемы индексации', desc: 'Неправильная индексация' },
  { id: 'technical', name: 'Технические проблемы', desc: 'Скорость, структура, коды' },
];

export default function App() {
  // State
  const [siteName, setSiteName] = useState('');
  const [taskSummary, setTaskSummary] = useState('');
  const [selectedProblemType, setSelectedProblemType] = useState<string | null>(null);
  const [problemDescription, setProblemDescription] = useState('');
  const [exampleUrls, setExampleUrls] = useState('');
  const [businessGoal, setBusinessGoal] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState('');
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('seo-tz-form');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSiteName(data.siteName || '');
        setTaskSummary(data.taskSummary || '');
        setSelectedProblemType(data.selectedProblemType || null);
        setProblemDescription(data.problemDescription || '');
        setExampleUrls(data.exampleUrls || '');
        setBusinessGoal(data.businessGoal || '');
        setAdditionalDetails(data.additionalDetails || '');
      } catch (e) {
        console.error('Failed to parse local storage', e);
      }
    }
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    const data = {
      siteName,
      taskSummary,
      selectedProblemType,
      problemDescription,
      exampleUrls,
      businessGoal,
      additionalDetails,
    };
    localStorage.setItem('seo-tz-form', JSON.stringify(data));
  }, [siteName, taskSummary, selectedProblemType, problemDescription, exampleUrls, businessGoal, additionalDetails]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
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
Ты — профессиональный SEO-специалист. Создай подробное техническое задание (ТЗ) в формате Markdown на основе следующих данных:

- Название сайта: ${siteName.trim()}
- Суть задачи: ${taskSummary.trim()}
- Тип проблемы: ${problemTypeName}
- Подробное описание проблемы: ${problemDescription.trim()}
- Примеры URL:
${exampleUrls.trim() || 'Не указаны'}
- Бизнес-цель: ${businessGoal.trim() || 'Не указана'}
- Дополнительные детали: ${additionalDetails.trim() || 'Нет'}

ТЗ должно иметь четкую и профессиональную структуру. Обязательно включи следующие разделы:

1.  **Заголовок:** [Название сайта] - ТЗ на [Суть задачи]
2.  **Что не так на сайте?** (Подробно опиши проблему, объясни, как она связана с выбранным типом SEO-проблемы — "${problemTypeName}" — и почему это плохо для SEO.)
3.  **Примеры URL:** (Перечисли предоставленные URL, если они есть.)
4.  **Для чего нужны изменения?** (Сформулируй бизнес-цель и конкретную SEO-цель, которую нужно достичь.)
5.  **Что необходимо сделать с точки зрения SEO?** (Предоставь пошаговый, детализированный план решения проблемы. План должен быть конкретным, техническим и релевантным для типа проблемы "${problemTypeName}".)
6.  **Дополнительные требования:** (Включи стандартные требования, такие как тестирование на dev-среде, бэкапы и мониторинг после внедрения. Также включи предоставленные пользователем дополнительные детали.)
7.  **Критерии приемки:** (Перечисли конкретные, измеримые критерии, по которым можно будет судить, что задача выполнена успешно.)
8.  **Ожидаемый результат:** (Опиши позитивные изменения в SEO-показателях после выполнения ТЗ.)
9.  **Срок реализации:** (Укажи примерный срок, например "5-7 рабочих дней".)
10. **Приоритет:** (Укажи приоритет, например "Высокий".)

Сделай ТЗ профессиональным, структурированным и понятным для разработчика. Используй Markdown для форматирования.
`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
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
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide">Drafting Mode</span>
          <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-300"></div>
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
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-none min-h-[80px]"
              placeholder="Опишите проблему подробно..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="exampleUrls" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Примеры URL</label>
            <textarea
              id="exampleUrls"
              value={exampleUrls}
              onChange={(e) => setExampleUrls(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-none min-h-[80px]"
              placeholder="https://example.com/page1&#10;https://example.com/page2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessGoal" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Бизнес-цель</label>
            <textarea
              id="businessGoal"
              value={businessGoal}
              onChange={(e) => setBusinessGoal(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-none min-h-[80px]"
              placeholder="Какую бизнес-цель решает эта задача?"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="additionalDetails" className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Дополнительные детали</label>
            <textarea
              id="additionalDetails"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm text-slate-800 bg-[#fafafa] focus:outline-none focus:border-blue-600 focus:bg-white transition-colors resize-none min-h-[80px]"
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
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Сгенерированное ТЗ
              </h2>
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
            <textarea
              value={generatedTask}
              readOnly
              className="w-full flex-1 focus:outline-none text-[#334155] font-mono text-sm leading-[1.6] resize-none bg-transparent min-h-[500px]"
              placeholder="Здесь появится сгенерированное AI техническое задание..."
            />
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
    </div>
  );
}
