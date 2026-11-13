/* Browser-only application. Quran text always comes from the downloaded Tanzil corpus. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const arabicNumber = value => String(value).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const data = window.QURAN_DATA;
  let current = null;
  let index;
  let recognition = null;
  let listening = false;
  let stopping = false;
  let recognitionFailed = false;
  let finalSegments = [];
  let interimText = '';
  let speechAlternatives = [];
  let toastTimer;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
  }

  function voiceStatus(message, error = false) {
    $('voice-status').textContent = message;
    $('voice-status').classList.toggle('error', error);
  }

  function setListening(active) {
    listening = active;
    document.body.classList.toggle('listening', active);
    $('mic-button').setAttribute('aria-pressed', String(active));
    $('mic-button').setAttribute('aria-label', active ? 'إنهاء الاستماع والبحث' : 'بدء الاستماع');
    $('mic-title').textContent = active ? 'نستمع إليك… تفضّل بالقراءة' : 'اضغط واقرأ جزءًا من آية';
    $('mic-description').textContent = active ? 'اضغط الميكروفون مرة أخرى عند الانتهاء' : 'ثلاث كلمات أو أكثر تساعدنا على العثور عليها';
  }

  function cancelListening() {
    if (!recognition || !listening) return;
    recognitionFailed = true;
    recognition.abort();
    setListening(false);
    voiceStatus('جاهز للاستماع');
  }

  function getSurah(number) { return data.surahs.find(s => s.number === Number(number)); }

  function showVerse(surahNumber, ayahNumber, state = 'تم العثور على الآية') {
    const surah = getSurah(surahNumber);
    if (!surah || ayahNumber < 1 || ayahNumber > surah.ayahs.length) return;
    current = {surahNumber: surah.number, ayahNumber};
    $('result-body').hidden = false;
    $('search-message').hidden = true;
    $('candidates').hidden = true;
    $('candidates').replaceChildren();
    $('verse-surah').textContent = 'سورة ' + surah.name;
    $('verse-number').textContent = 'الآية ' + arabicNumber(ayahNumber);
    $('verse-text').textContent = surah.ayahs[ayahNumber - 1];
    $('verse-text').classList.toggle('long', surah.ayahs[ayahNumber - 1].length > 190);
    $('ayah-end').textContent = arabicNumber(ayahNumber);
    $('result-state').textContent = state;
    $('result-state').classList.toggle('matched', state !== 'مثال للبدء');
    $('result-note').textContent = state === 'مثال للبدء' ? 'جرّب قراءة جزء من هذه الآية أو اكتب أي آية تتذكّرها.' : 'واصل رحلتك مع القرآن بالانتقال إلى الآية التالية.';
    $('prev-button').disabled = surahNumber === 1 && ayahNumber === 1;
    $('next-button').disabled = surahNumber === 114 && ayahNumber === 6;
    $('copy-button').disabled = false;
    $('result-card').setAttribute('aria-busy', 'false');
    $('result-card').setAttribute('aria-label', 'سورة ' + surah.name + ' الآية ' + arabicNumber(ayahNumber));
    history.replaceState(null, '', '#verse=' + surahNumber + ':' + ayahNumber);
  }

  function clearResult(message, state) {
    current = null;
    history.replaceState(null, '', '#');
    $('result-body').hidden = true;
    $('search-message').hidden = false;
    $('search-message').textContent = message;
    $('candidates').hidden = true;
    $('candidates').replaceChildren();
    $('result-state').textContent = state;
    $('result-state').classList.remove('matched');
    $('prev-button').disabled = true;
    $('next-button').disabled = true;
    $('copy-button').disabled = true;
    $('result-card').setAttribute('aria-label', state);
    $('result-card').setAttribute('aria-busy', 'false');
  }

  function showCandidates(matches) {
    const approximate = matches[0].matchType !== 'exact';
    clearResult(approximate ? 'وجدنا آيات قريبة من الكلمات التي أدخلتها. تحقّق من النص، ثم اختر الآية المقصودة.' : 'ورد هذا المقطع في أكثر من آية. اختر الآية المقصودة، أو أضف كلمات أخرى لتحديدها.', approximate ? 'تحقّق من النتيجة' : 'اختر آيتك');
    $('candidates').hidden = false;
    for (const match of matches) {
      const button = document.createElement('button');
      button.className = 'candidate';
      const meta = document.createElement('span');
      meta.className = 'candidate-meta';
      meta.textContent = 'سورة ' + getSurah(match.surahNumber).name + ' · الآية ' + arabicNumber(match.ayahNumber);
      const text = document.createElement('span');
      text.className = 'candidate-text';
      text.textContent = match.text;
      button.append(meta, text);
      button.addEventListener('click', () => { showVerse(match.surahNumber, match.ayahNumber, 'آيتك المختارة'); $('result-state').focus?.(); });
      $('candidates').append(button);
    }
  }

  function runSearch(query, alternatives = []) {
    if (!index) return;
    const cleaned = window.AyahMatcher.normalize(query);
    if (!cleaned) {
      clearResult('اقرأ أو اكتب جزءًا من آية أولًا. ثلاث كلمات أو أكثر تعطي نتائج أدق.', 'ابدأ بجزء من آية');
      $('verse-input').focus();
      return;
    }
    const options = {surahNumber: $('surah-filter').value ? Number($('surah-filter').value) : null, limit: 6};
    let matches = window.AyahMatcher.search(index, query, options);
    // Alternative speech transcripts are only used if the primary transcript has no exact hit.
    if (!matches.some(m => m.matchType === 'exact')) {
      for (const alternative of alternatives) {
        const other = window.AyahMatcher.search(index, alternative, options);
        if (other[0]?.matchType === 'exact') {
          matches = other;
          $('verse-input').value = alternative;
          break;
        }
      }
    }
    if (!matches.length) {
      clearResult('لم نجد آية مطابقة لهذا المقطع. جرّب ثلاث كلمات متتالية أو أكثر، أو صحّح الكلمات التي سمعها المتصفح.' + (options.surahNumber ? '\nالبحث محدّد بسورة واحدة؛ يمكنك اختيار القرآن كاملًا.' : ''), 'جرّب مقطعًا آخر');
      return;
    }
    const exact = matches.filter(m => m.matchType === 'exact');
    if (exact.length === 1) showVerse(exact[0].surahNumber, exact[0].ayahNumber);
    else showCandidates(exact.length ? exact : matches);
  }

  function navigateVerse(direction) {
    if (!current) return;
    let {surahNumber, ayahNumber} = current;
    ayahNumber += direction;
    if (ayahNumber > getSurah(surahNumber).ayahs.length) { surahNumber++; ayahNumber = 1; }
    if (ayahNumber < 1) { surahNumber--; ayahNumber = getSurah(surahNumber)?.ayahs.length; }
    if (surahNumber >= 1 && surahNumber <= 114) showVerse(surahNumber, ayahNumber, 'تابع تلاوتك');
  }

  function initSpeech() {
    if (!SpeechRecognition) {
      voiceStatus('الإدخال الصوتي غير متاح هنا؛ جرّب Chrome أو استخدم الكتابة.', true);
      $('mic-button').setAttribute('aria-label', 'الإدخال الصوتي غير متاح؛ استخدم الكتابة');
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => {
      setListening(true);
      voiceStatus('استمعنا إليك… اقرأ بوضوح وبهدوء');
    };
    recognition.onresult = event => {
      finalSegments = [];
      interimText = '';
      speechAlternatives = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalSegments.push(result[0].transcript);
        else interimText += ' ' + result[0].transcript;
      }
      for (let alt = 1; alt < 3; alt++) {
        const transcript = Array.from(event.results, r => (r[alt] || r[0]).transcript).join(' ').trim();
        if (transcript) speechAlternatives.push(transcript);
      }
      $('verse-input').value = (finalSegments.join(' ') + ' ' + interimText).trim();
      voiceStatus('تظهر الكلمات التي نسمعها في خانة البحث');
    };
    recognition.onerror = event => {
      recognitionFailed = true;
      const messages = {
        'not-allowed': 'لم يُسمح بالميكروفون. فعّله من إعدادات الموقع أو استخدم الكتابة.',
        'service-not-allowed': 'خدمة التعرّف على الصوت غير متاحة. جرّب Chrome أو استخدم الكتابة.',
        'audio-capture': 'لم نعثر على ميكروفون. تأكّد من توصيله أو استخدم الكتابة.',
        'no-speech': 'لم نسمع كلمات واضحة. اضغط الميكروفون وحاول مجددًا.',
        'network': 'تعذّر الاتصال بخدمة الصوت. تحقّق من الإنترنت أو استخدم الكتابة.',
        'language-not-supported': 'التعرّف على العربية غير متاح في هذا المتصفح. استخدم الكتابة.'
      };
      voiceStatus(messages[event.error] || 'تعذّر التعرّف على الصوت. حاول مجددًا أو استخدم الكتابة.', true);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      stopping = false;
      $('mic-button').disabled = false;
      const transcript = (finalSegments.join(' ') + ' ' + interimText).trim();
      if (!recognitionFailed && transcript) {
        voiceStatus('اكتمل الاستماع. يمكنك تعديل الكلمات وإعادة البحث.');
        runSearch(transcript, speechAlternatives);
      } else if (!recognitionFailed) voiceStatus('لم نسمع كلمات واضحة. حاول مجددًا.', true);
    };
  }

  $('mic-button').addEventListener('click', () => {
    if (!recognition) { toast('استخدم Chrome أو Edge للإدخال الصوتي، أو اكتب جزءًا من الآية.'); $('verse-input').focus(); return; }
    if (stopping) return;
    if (listening) {
      stopping = true;
      $('mic-button').disabled = true;
      voiceStatus('جارٍ إنهاء الاستماع…');
      recognition.stop();
      return;
    }
    if (!window.isSecureContext) { voiceStatus('الميكروفون يحتاج رابط HTTPS. يمكنك استخدام الكتابة الآن.', true); $('verse-input').focus(); return; }
    recognitionFailed = false;
    finalSegments = [];
    interimText = '';
    speechAlternatives = [];
    $('verse-input').value = '';
    try { setListening(true); voiceStatus('جارٍ تشغيل الميكروفون…'); recognition.start(); }
    catch { setListening(false); voiceStatus('تعذّر بدء الميكروفون. حاول مجددًا.', true); }
  });

  $('search-form').addEventListener('submit', event => { event.preventDefault(); cancelListening(); runSearch($('verse-input').value); });
  $('prev-button').addEventListener('click', () => navigateVerse(-1));
  $('next-button').addEventListener('click', () => navigateVerse(1));
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
    cancelListening(); $('verse-input').value = button.dataset.query; $('surah-filter').value = ''; runSearch(button.dataset.query);
    if (matchMedia('(max-width: 900px)').matches) $('result-card').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
  }));

  $('copy-button').addEventListener('click', async () => {
    if (!current) return;
    const surah = getSurah(current.surahNumber);
    const text = surah.ayahs[current.ayahNumber - 1] + '\n[سورة ' + surah.name + '، الآية ' + arabicNumber(current.ayahNumber) + ']';
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
        const success = document.execCommand('copy'); area.remove(); if (!success) throw new Error('copy');
      }
      toast('تم نسخ الآية');
    } catch { toast('تعذّر النسخ. يمكنك تحديد نص الآية ونسخه يدويًا.'); }
  });

  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => $(button.dataset.dialog).showModal()));
  document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } }));
  $('home-nav').addEventListener('click', () => { $('verse-input').focus(); window.scrollTo({top: 0, behavior: 'smooth'}); });
  $('browse-nav').addEventListener('click', () => { cancelListening(); if (current) { $('browse-surah').value = String(current.surahNumber); updateBrowseCount(); $('browse-ayah').value = current.ayahNumber; } $('browse-dialog').showModal(); });
  function updateBrowseCount() { const total = getSurah($('browse-surah').value).ayahs.length; $('browse-ayah').max = total; if (Number($('browse-ayah').value) > total) $('browse-ayah').value = 1; $('browse-count').textContent = 'عدد الآيات: ' + arabicNumber(total); }
  $('browse-surah').addEventListener('change', updateBrowseCount);
  $('browse-form').addEventListener('submit', event => { event.preventDefault(); const n = Number($('browse-ayah').value); if (!Number.isInteger(n)) return; showVerse(Number($('browse-surah').value), n, 'من المصحف'); $('browse-dialog').close(); $('result-card').scrollIntoView({block: 'nearest'}); });
  window.addEventListener('pagehide', cancelListening);

  if (!data || !window.AyahMatcher) {
    clearResult('تعذّر تحميل نص المصحف. أعد فتح الصفحة، وتأكّد من وجود مجلد البيانات مع ملفات الموقع.', 'تعذّر التحميل');
    $('mic-button').disabled = true; document.querySelector('button[type="submit"]').disabled = true;
    return;
  }
  index = window.AyahMatcher.createIndex(data.surahs);
  $('sidebar-verse-text').textContent = getSurah(94).ayahs[4];
  const exampleReferences = [[94, 5], [93, 5], [2, 255]];
  document.querySelectorAll('.example-verse').forEach((element, i) => {
    const [surah, ayah] = exampleReferences[i];
    const original = getSurah(surah).ayahs[ayah - 1];
    element.textContent = surah === 2 ? original.split(' ').slice(0, 9).join(' ') + '…' : original;
  });
  for (const surah of data.surahs) {
    for (const select of [$('surah-filter'), $('browse-surah')]) {
      const option = document.createElement('option'); option.value = surah.number; option.textContent = arabicNumber(surah.number) + ' · ' + surah.name; select.append(option);
    }
  }
  updateBrowseCount();
  const hash = location.hash.match(/^#verse=(\d{1,3}):(\d{1,3})$/);
  if (hash && getSurah(Number(hash[1]))?.ayahs[Number(hash[2]) - 1]) showVerse(Number(hash[1]), Number(hash[2]), 'من المصحف');
  else showVerse(94, 5, 'مثال للبدء');
  initSpeech();
})();
