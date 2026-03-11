/**
 * i18n.js — All UI translations (English + Arabic)
 * Single source of truth for all string content.
 * Adding a new language: add a new top-level key and mirror all fields.
 */

"use strict"

export const i18n = {
  en: {
    // ── Brand ─────────────────────────────────────────────
    brandSubtitle:        "Professional ATS Resume Builder",

    // ── Hero ──────────────────────────────────────────────
    heroBadge:            "✦ ATS-Optimized Resume Builder",
    heroTitle:            "Build a professional resume that passes ATS systems",
    heroDescription:      "Create a polished bilingual resume with live preview, AI analysis, structured sections, template switching, autosave, and real PDF export.",
    heroFeature1:         "⚡ Live Preview",
    heroFeature2:         "🌐 Arabic + English",
    heroFeature3:         "📄 Real PDF Export",
    heroFeature4:         "✅ ATS Ready",
    heroFeature5:         "✦ AI Analysis",
    statTemplates:        "Templates",
    statFree:             "Free",
    statAI:               "Powered",

    // ── Editor ────────────────────────────────────────────
    editorTitle:          "Resume Editor",
    editorSubtitle:       "Fill your details and watch the resume update instantly.",
    previewTitle:         "Live Preview",
    previewSubtitle:      "Your ATS-ready resume updates in real time.",
    atsLabel:             "ATS Score",
    atsHint:              "Fill more fields to improve your score",
    atsHintGood:          "Excellent resume!",
    atsHintMedium:        "Good — add more to improve",

    // ── Sections ──────────────────────────────────────────
    sectionPersonal:      "Personal Information",
    sectionEducation:     "Education",
    sectionExperience:    "Work Experience",
    sectionProjects:      "Projects",
    sectionCertifications:"Certifications",
    sectionSkillsLanguages:"Skills & Languages",

    // ── Labels ────────────────────────────────────────────
    labelFullName:        "Full Name",
    labelTargetRole:      "Target Role",
    labelEmail:           "Email",
    labelPhone:           "Phone",
    labelLocation:        "Location",
    labelProfileType:     "Profile Type",
    labelLinkedin:        "LinkedIn",
    labelGithub:          "GitHub / Portfolio",
    labelSummary:         "Professional Summary",
    labelSkills:          "Skills",
    labelLanguages:       "Languages",

    // ── Hints ─────────────────────────────────────────────
    summaryHint:          "Keep it clear, direct, and relevant to the target job.",
    skillsHint:           "Separate each skill with a comma.",
    languagesHint:        "Choose a language and its proficiency level.",

    // ── Preview headings ──────────────────────────────────
    cvSummaryHeading:       "Professional Summary",
    cvEducationHeading:     "Education",
    cvExperienceHeading:    "Experience",
    cvProjectsHeading:      "Projects",
    cvSkillsHeading:        "Skills",
    cvCertificationsHeading:"Certifications",
    cvLanguagesHeading:     "Languages",

    // ── Buttons ───────────────────────────────────────────
    addEducation:         "+ Add",
    addExperience:        "+ Add",
    addProject:           "+ Add",
    addCertification:     "+ Add",
    addLanguage:          "+ Add Language",
    analyzeBtn:           "Analyze My Resume",
    previewToggleShow:    "👁 Show Preview",
    previewToggleHide:    "✕ Hide Preview",

    // ── Card labels ───────────────────────────────────────
    educationCardTitle:   "EDUCATION",
    experienceCardTitle:  "EXPERIENCE",
    projectCardTitle:     "PROJECT",
    certCardTitle:        "CERTIFICATION",
    languageCardTitle:    "LANGUAGE",
    degreeLabel:          "Degree",
    universityLabel:      "University / Institution",
    startLabel:           "Start",
    endLabel:             "End",
    currentLabel:         "Currently enrolled",
    gpaLabel:             "GPA (optional)",
    jobTitleLabel:        "Job Title",
    companyLabel:         "Company",
    currentJobLabel:      "Currently working here",
    descLabel:            "Description",
    projectNameLabel:     "Project Name",
    projectUrlLabel:      "URL (optional)",
    certNameLabel:        "Certification Name",
    issuerLabel:          "Issuer",
    dateLabel:            "Date",
    languageLabel:        "Language",
    levelLabel:           "Level",
    removeLabel:          "Remove",

    // ── Placeholders ──────────────────────────────────────
    fullNamePlaceholder:   "Enter your full name",
    targetRolePlaceholder: "e.g. Software Engineer",
    emailPlaceholder:      "name@example.com",
    phonePlaceholder:      "+966 5X XXX XXXX",
    locationPlaceholder:   "Saudi Arabia",
    summaryPlaceholder:    "Write a concise summary about your background, strengths, and career focus.",
    skillsPlaceholder:     "JavaScript, React, Node.js, Python, SQL...",

    // ── AI Panel ──────────────────────────────────────────
    aiPanelTitle:         "AI Resume Analyzer",
    aiLoadingText:        "Analyzing your resume...",
    aiEmptyText:          "Click \"Analyze\" to get AI-powered feedback on your resume.",
    aiReanalyze:          "✦ Re-analyze",

    // ── Share ─────────────────────────────────────────────
    shareModalTitle:      "Share Your Resume",
    shareModalDesc:       "Anyone with this link can view your resume. Copy and share it anywhere.",
    shareCopiedText:      "Link copied to clipboard!",
    shareNote:            "⚡ No account needed — the link contains your full resume data.",
    copyBtnLabel:         "Copy",
    copyBtnCopied:        "Copied!",
    whatsappMsg:          "Check out my professional resume built with CreateCV:",
    emailSubject:         "My Professional Resume — CreateCV",
    emailBody:            "Hi,\n\nPlease find my professional resume at the link below:\n\n",
    toastShareOpened:     "🔗 Share link generated!",

    // ── Toasts ────────────────────────────────────────────
    toastSaved:           "✓ Resume saved successfully",
    toastCleared:         "Resume cleared",
    toastPdf:             "Generating PDF...",
    toastPdfSuccess:      "✓ PDF downloaded successfully",
    toastPdfError:        "PDF export failed, please try again",
    toastSampleLoaded:    "✓ Sample data loaded",
    toastSharedLoaded:    "✓ Resume loaded from shared link",
    toastAnalysisError:   "Analysis failed, please try again",
    toastPdfLibError:     "Failed to load PDF library",

    // ── Confirm dialogs ───────────────────────────────────
    confirmClearTitle:    "Clear all data?",
    confirmClearBody:     "This will permanently delete everything you've entered. This cannot be undone.",
    confirmClearYes:      "Yes, Clear",
    confirmClearNo:       "Cancel",
  },

  ar: {
    brandSubtitle:        "منشئ السيرة الذاتية الاحترافي",
    heroBadge:            "✦ منشئ سيرة ذاتية متوافق مع أنظمة ATS",
    heroTitle:            "أنشئ سيرة ذاتية احترافية تجتاز أنظمة التصفية الآلي",
    heroDescription:      "أنشئ سيرة ذاتية ثنائية اللغة مع معاينة فورية، تحليل ذكاء اصطناعي، قوالب متعددة، حفظ تلقائي، وتصدير PDF حقيقي.",
    heroFeature1:         "⚡ معاينة فورية",
    heroFeature2:         "🌐 عربي + إنجليزي",
    heroFeature3:         "📄 تصدير PDF حقيقي",
    heroFeature4:         "✅ متوافق مع ATS",
    heroFeature5:         "✦ تحليل ذكاء اصطناعي",
    statTemplates:        "قوالب",
    statFree:             "مجاني",
    statAI:               "بالذكاء الاصطناعي",

    editorTitle:          "محرر السيرة الذاتية",
    editorSubtitle:       "أدخل بياناتك وشاهد السيرة تتحدث فوراً.",
    previewTitle:         "المعاينة المباشرة",
    previewSubtitle:      "سيرتك الذاتية تتحدث في الوقت الفعلي.",
    atsLabel:             "نقاط ATS",
    atsHint:              "أكمل المزيد من الحقول لرفع نقاطك",
    atsHintGood:          "سيرتك ممتازة!",
    atsHintMedium:        "جيد، أضف المزيد لتحسين النقاط",

    sectionPersonal:      "المعلومات الشخصية",
    sectionEducation:     "التعليم",
    sectionExperience:    "الخبرة العملية",
    sectionProjects:      "المشاريع",
    sectionCertifications:"الشهادات والدورات",
    sectionSkillsLanguages:"المهارات واللغات",

    labelFullName:        "الاسم الكامل",
    labelTargetRole:      "المسمى الوظيفي المستهدف",
    labelEmail:           "البريد الإلكتروني",
    labelPhone:           "الهاتف",
    labelLocation:        "الموقع",
    labelProfileType:     "نوع الملف الشخصي",
    labelLinkedin:        "لينكد إن",
    labelGithub:          "GitHub / معرض الأعمال",
    labelSummary:         "الملخص المهني",
    labelSkills:          "المهارات",
    labelLanguages:       "اللغات",

    summaryHint:          "اجعله واضحاً ومختصراً ومتعلقاً بالوظيفة المستهدفة.",
    skillsHint:           "افصل كل مهارة بفاصلة.",
    languagesHint:        "اختر اللغة ومستوى إتقانها.",

    cvSummaryHeading:       "الملخص المهني",
    cvEducationHeading:     "التعليم",
    cvExperienceHeading:    "الخبرة العملية",
    cvProjectsHeading:      "المشاريع",
    cvSkillsHeading:        "المهارات",
    cvCertificationsHeading:"الشهادات والدورات",
    cvLanguagesHeading:     "اللغات",

    addEducation:         "+ إضافة",
    addExperience:        "+ إضافة",
    addProject:           "+ إضافة",
    addCertification:     "+ إضافة",
    addLanguage:          "+ إضافة لغة",
    analyzeBtn:           "تحليل سيرتي الذاتية",
    previewToggleShow:    "👁 عرض المعاينة",
    previewToggleHide:    "✕ إخفاء المعاينة",

    educationCardTitle:   "تعليم",
    experienceCardTitle:  "خبرة",
    projectCardTitle:     "مشروع",
    certCardTitle:        "شهادة",
    languageCardTitle:    "لغة",
    degreeLabel:          "الدرجة العلمية",
    universityLabel:      "الجامعة / المعهد",
    startLabel:           "من",
    endLabel:             "إلى",
    currentLabel:         "لا أزال مقيداً",
    gpaLabel:             "المعدل التراكمي (اختياري)",
    jobTitleLabel:        "المسمى الوظيفي",
    companyLabel:         "الشركة / الجهة",
    currentJobLabel:      "أعمل هنا حالياً",
    descLabel:            "الوصف",
    projectNameLabel:     "اسم المشروع",
    projectUrlLabel:      "الرابط (اختياري)",
    certNameLabel:        "اسم الشهادة",
    issuerLabel:          "الجهة المانحة",
    dateLabel:            "التاريخ",
    languageLabel:        "اللغة",
    levelLabel:           "المستوى",
    removeLabel:          "حذف",

    fullNamePlaceholder:   "أدخل اسمك الكامل",
    targetRolePlaceholder: "مثال: مهندس برمجيات",
    emailPlaceholder:      "name@example.com",
    phonePlaceholder:      "+966 5X XXX XXXX",
    locationPlaceholder:   "المملكة العربية السعودية",
    summaryPlaceholder:    "اكتب ملخصاً مختصراً عن خلفيتك ونقاط قوتك وهدفك المهني.",
    skillsPlaceholder:     "JavaScript، React، Node.js، Python، SQL...",

    aiPanelTitle:         "محلل السيرة الذاتية بالذكاء الاصطناعي",
    aiLoadingText:        "جاري تحليل سيرتك الذاتية...",
    aiEmptyText:          "اضغط على \"تحليل\" للحصول على تغذية راجعة ذكية لسيرتك الذاتية.",
    aiReanalyze:          "✦ إعادة التحليل",

    shareModalTitle:      "شارك سيرتك الذاتية",
    shareModalDesc:       "أي شخص يملك هذا الرابط يمكنه عرض سيرتك الذاتية.",
    shareCopiedText:      "تم نسخ الرابط!",
    shareNote:            "⚡ لا تحتاج حساباً — الرابط يحتوي على كل بياناتك.",
    copyBtnLabel:         "نسخ",
    copyBtnCopied:        "تم النسخ!",
    whatsappMsg:          "شاهد سيرتي الذاتية الاحترافية من CreateCV:",
    emailSubject:         "سيرتي الذاتية الاحترافية — CreateCV",
    emailBody:            "مرحباً،\n\nيمكنك الاطلاع على سيرتي الذاتية عبر الرابط التالي:\n\n",
    toastShareOpened:     "🔗 تم إنشاء رابط المشاركة!",

    toastSaved:           "✓ تم حفظ السيرة الذاتية بنجاح",
    toastCleared:         "تم مسح البيانات",
    toastPdf:             "جاري إنشاء ملف PDF...",
    toastPdfSuccess:      "✓ تم تحميل PDF بنجاح",
    toastPdfError:        "حدث خطأ في تحميل PDF",
    toastSampleLoaded:    "✓ تم تحميل البيانات النموذجية",
    toastSharedLoaded:    "✓ تم تحميل السيرة الذاتية من الرابط",
    toastAnalysisError:   "حدث خطأ أثناء التحليل، حاول مرة أخرى",
    toastPdfLibError:     "تعذر تحميل مكتبة PDF",

    confirmClearTitle:    "مسح جميع البيانات؟",
    confirmClearBody:     "سيتم حذف كل ما أدخلته بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.",
    confirmClearYes:      "نعم، احذف",
    confirmClearNo:       "إلغاء",
  },
}

/** @type {"en"|"ar"} */
export let currentLang = "en"

/**
 * Returns the translation object for the current language.
 * @returns {typeof i18n.en}
 */
export function t() {
  return i18n[currentLang] ?? i18n.en
}

/**
 * Sets the active language.
 * @param {"en"|"ar"} lang
 */
export function setLang(lang) {
  if (i18n[lang]) currentLang = lang
}