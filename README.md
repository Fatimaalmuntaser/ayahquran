# آية — رفيق تلاوتك

A simple Arabic, right-to-left Qur’an verse finder. Say or type a phrase to display its complete verse, then move to the next or previous verse.

## Open on a laptop

Unzip this folder and double-click **index.html**. No Python, Node, installation, account, or API key is needed. The entire Arabic Qur’an and the fonts are included. Typed search and verse browsing work without an internet connection.

For the microphone, open the hosted website in **Chrome or Edge**, allow microphone access, and speak at least three consecutive words in Arabic. Speech recognition depends on browser support, normally needs the internet, and works best on an HTTPS website. Local-file microphone access varies by browser. If speech is unavailable, type your phrase instead.

## Publish with GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder, keeping **index.html at the repository root**, alongside `styles.css`, `app.js`, `matcher.js`, `assets/`, and `data/`.
3. Open **Settings → Pages → Build and deployment**.
4. Choose **Deploy from a branch**, then **main** and **/ (root)**, and save.
5. Open the HTTPS address GitHub provides. Visitors need only their browser.

No build command or server code is required. The `.nojekyll` file prevents unnecessary Jekyll processing. This site also works on any ordinary static host.

## الاستخدام

- اضغط الميكروفون واسمح باستخدامه، ثم اقرأ جزءًا من آية. اضغط مرة أخرى لإنهاء الاستماع، أو انتظر انتهاء التعرّف على الصوت.
- أو اكتب ثلاث كلمات متتالية أو أكثر، ثم اضغط «أكمل الآية».
- إذا ورد المقطع في أكثر من آية، اختر الآية المقصودة. النتائج التقريبية تحتاج إلى اختيارك بعد التحقّق من النص.
- استخدم «الآية التالية» أو «الآية السابقة» لمواصلة التلاوة. تنتقل الأزرار بين السور أيضًا.
- اختر «تصفّح المصحف» لعرض سورة وآية بالرقم.
- البحث لا يقيّم التجويد أو يصحّح التلاوة، ولا يستخدم نموذجًا لتوليد نصّ القرآن.

## Qur’an source and preservation

Arabic Qur’an: **Tanzil Project**, Uthmani v1.1, downloaded November 13, 2026 from https://tanzil.net/ — 114 surahs, 6,236 verses. Verse text is preserved verbatim. The original download and metadata are in `data/`. The official Tanzil Simple Clean edition is used only to support ordinary Arabic speech/text matching. The displayed text always comes from the Uthmani edition. Introductory basmalas are stored separately as provided by Tanzil; they are not inserted into numbered verses.

Tanzil text is licensed under **Creative Commons Attribution 3.0**, with the project's requirement that its Qur’an text remain unchanged. See `data/LICENSE-TANZIL.txt` and https://tanzil.net/docs/Text_License. Preserve its copyright notices and visible source attribution when redistributing. Check https://tanzil.net/updates/ for updates.

Fonts: Tajawal and Noto Naskh Arabic, SIL Open Font License; license files included in `assets/`.

## Privacy and compatibility

This static site does not record or store microphone audio and has no analytics or app backend. Your browser's speech provider may process audio remotely under its own policies. Typed phrases are matched locally in the browser. No runtime third-party downloads are needed for the website or Qur’an corpus.

Modern Chrome, Edge, Firefox and Safari can use typed search and browsing. Voice entry specifically requires the browser's `SpeechRecognition` or `webkitSpeechRecognition` API with Arabic recognition enabled. Speech quality varies; you can edit the transcript before searching again.
