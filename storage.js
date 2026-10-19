/* ============================================================================
   تَاج الوَقَار (TAJ AL-WAQAR) - LOCAL-FIRST STORAGE & PLAN ENGINE
   الملف الرابع: storage.js
   المهمة: إدارة الحالة، توليد الخطط الواقعية، التعديل الحر، والنسخ الاحتياطي
   ============================================================================ */

const TajStorage = (() => {
    const STORAGE_KEY = 'TAJ_ALWAQAR_MASTER_DB_V1';

    // ========================================================================
    // 1. محرك الأرقام والتواريخ (Arabic Eastern ١٢٣ vs Latin 123)
    // ========================================================================
    const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    function formatNumber(value, system = null) {
        if (value === null || value === undefined) return '';
        const activeSys = system || (state?.settings?.numeralSystem || 'arab');
        const str = String(value);
        if (activeSys === 'latn') {
            return str.replace(/[٠-٩]/g, d => ARABIC_DIGITS.indexOf(d));
        }
        return str.replace(/\d/g, d => ARABIC_DIGITS[parseInt(d, 10)]);
    }

    function getTodayISO() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function addDaysISO(isoDate, daysToAdd) {
        const parts = (isoDate || getTodayISO()).split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setDate(d.getDate() + daysToAdd);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatArabicDate(isoDate, includeHijri = true) {
        try {
            const parts = (isoDate || getTodayISO()).split('-').map(Number);
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const numLocale = (state?.settings?.numeralSystem === 'latn') ? 'ar-EG-u-nu-latn' : 'ar-SA';

            const gregOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
            const gregStr = new Intl.DateTimeFormat(numLocale, gregOptions).format(dateObj);

            if (!includeHijri) return gregStr;

            const hijriOptions = { year: 'numeric', month: 'long', day: 'numeric', calendar: 'islamic-umalqura' };
            const hijriStr = new Intl.DateTimeFormat(numLocale, hijriOptions).format(dateObj);
            return `${gregStr} • ${hijriStr}`;
        } catch (e) {
            return isoDate;
        }
    }

    function uid(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    // ========================================================================
    // 2. محرك توليد الجداول الواقعية (Realistic Plan & Schedule Generator)
    // ========================================================================
    /*
       يبني جدولاً زمنياً واقعياً يراعي:
       - أيام الحفظ الجديد في الأسبوع (مثلاً 5 أيام)
       - يوم المراجعة التجميعية الأسبوعي (تثبيت كل ما حُفظ في الأسبوع)
       - يوم الراحة والاحتياط الأسبوعي (لتفريغ الضغط أو التعويض)
       - يدعم (المنهج الثلاثي الراسخ) أو (المنهج المرن المخصص)
    */
    function generatePlanSchedule(config) {
        const {
            title = "مسار الحفظ والإتقان",
            methodology = "triple",        // 'triple' (حفظ + قريب + بعيد) أو 'flexible' (مرن مخصص)
            unitType = "page",             // 'page' (بالصفحات) أو 'rub' (بالأرباع)
            startPage = 1,
            endPage = 604,
            dailyAmount = 1,               // عدد الصفحات أو الأرباع يومياً
            nearReviewWindow = 5,          // عدد صفحات المراجعة القريبة (التثبيت الحديث)
            farReviewPages = 10,           // عدد صفحات المراجعة الكبرى (الماضي البعيد)
            workDaysPerWeek = 5,           // عدد أيام الحفظ الجديد في الأسبوع (من 1 إلى 7)
            hasWeeklyReviewDay = true,     // تخصيص يوم مراجعة تجميعية أسبوعي
            hasWeeklyRestDay = true,       // تخصيص يوم راحة واحتياط أسبوعي
            customPillars = [],            // أعمدة إضافية حرة يحددها المستخدم
            startDate = getTodayISO()
        } = config;

        const cleanStart = QuranData.clampPage(startPage);
        const cleanEnd = QuranData.clampPage(Math.max(cleanStart, endPage));
        const stepPages = unitType === 'rub'
            ? Math.max(1, Math.round(dailyAmount * 2.5))
            : Math.max(1, Number(dailyAmount) || 1);

        const days = [];
        let cursorPage = cleanStart;
        let farCursor = 1;
        let currentDate = startDate;
        let dayCounter = 1;
        let workDaysInCurrentCycle = 0;
        let weekStartMemorizedPage = cleanStart;

        // حماية من الحلقات اللانهائية بحد أقصى 1500 يوم للخطة الواحدة
        while (cursorPage <= cleanEnd && dayCounter <= 1500) {
            // 1. فحص هل حان موعد يوم المراجعة التجميعية الأسبوعي؟
            if (workDaysInCurrentCycle >= workDaysPerWeek) {
                const weekEndPage = Math.max(weekStartMemorizedPage, cursorPage - 1);

                if (hasWeeklyReviewDay) {
                    const consolRange = QuranData.describePageRange(weekStartMemorizedPage, weekEndPage, n => formatNumber(n));
                    const reviewTasks = [
                        {
                            id: uid('tsk'),
                            type: 'consolidation',
                            tag: 'مراجعة تجميعية أسبوعية',
                            title: `تثبيت حصيلة الأسبوع (${consolRange.pageText})`,
                            meta: `${consolRange.surahText} • ${consolRange.hizbText}`,
                            fromPage: weekStartMemorizedPage,
                            toPage: weekEndPage,
                            completed: false,
                            quality: 0
                        }
                    ];

                    // إضافة مراجعة كبرى في يوم التجميع إن كان المنهج ثلاثياً
                    if (methodology === 'triple' && weekEndPage > 10) {
                        const farEnd = Math.min(weekEndPage, farCursor + farReviewPages - 1);
                        const farDesc = QuranData.describePageRange(farCursor, farEnd, n => formatNumber(n));
                        reviewTasks.push({
                            id: uid('tsk'),
                            type: 'far',
                            tag: 'الماضي البعيد (الكبرى)',
                            title: `مراجعة تراكمية (${farDesc.pageText})`,
                            meta: `${farDesc.surahText} • ${farDesc.hizbText}`,
                            fromPage: farCursor,
                            toPage: farEnd,
                            completed: false,
                            quality: 0
                        });
                        farCursor = (farEnd >= weekEndPage) ? 1 : (farEnd + 1);
                    }

                    days.push({
                        id: uid('day'),
                        dayNumber: dayCounter++,
                        date: currentDate,
                        dayType: 'review', // 'work' | 'review' | 'rest'
                        label: `يوم التثبيت والمراجعة الأسبوعية`,
                        tasks: reviewTasks,
                        note: ''
                    });
                    currentDate = addDaysISO(currentDate, 1);
                }

                // 2. فحص هل حان موعد يوم الراحة والاحتياط؟
                if (hasWeeklyRestDay) {
                    days.push({
                        id: uid('day'),
                        dayNumber: dayCounter++,
                        date: currentDate,
                        dayType: 'rest',
                        label: `يوم الراحة والاحتياط الأسبوعي`,
                        tasks: [
                            {
                                id: uid('tsk'),
                                type: 'rest',
                                tag: 'استجمام أو تعويض',
                                title: 'تلاوة حرة خفيفة أو استدراك ما فات خلال الأسبوع',
                                meta: 'يوم مرن لامتصاص الطوارئ وتجديد النشاط الذهني',
                                fromPage: weekStartMemorizedPage,
                                toPage: weekEndPage,
                                completed: false,
                                quality: 0
                            }
                        ],
                        note: ''
                    });
                    currentDate = addDaysISO(currentDate, 1);
                }

                // تصفير عداد الأسبوع وبدء دورة أسبوعية جديدة
                workDaysInCurrentCycle = 0;
                weekStartMemorizedPage = cursorPage;
                continue;
            }

            // 3. بناء يوم إنجاز اعتيادي (Work Day)
            const todayEndPage = Math.min(cleanEnd, cursorPage + stepPages - 1);
            const newRange = QuranData.describePageRange(cursorPage, todayEndPage, n => formatNumber(n));
            const dayTasks = [];

            // العمود الأول: الحفظ الجديد (أو الورد الأساسي)
            dayTasks.push({
                id: uid('tsk'),
                type: 'new',
                tag: methodology === 'triple' ? 'الحفظ الجديد' : 'الورد الأساسي',
                title: `حفظ وإتقان ${newRange.pageText}`,
                meta: `${newRange.surahText} • ${newRange.hizbText}`,
                fromPage: cursorPage,
                toPage: todayEndPage,
                completed: false,
                quality: 0
            });

            if (methodology === 'triple') {
                // العمود الثاني: المراجعة القريبة (الماضي القريب - تثبيت آخر صفحات)
                if (cursorPage > cleanStart || cleanStart > 1) {
                    const nearEnd = Math.max(1, cursorPage - 1);
                    const nearStart = Math.max(1, nearEnd - nearReviewWindow + 1);
                    if (nearEnd >= nearStart && cursorPage > 1) {
                        const nearRange = QuranData.describePageRange(nearStart, nearEnd, n => formatNumber(n));
                        dayTasks.push({
                            id: uid('tsk'),
                            type: 'near',
                            tag: 'الماضي القريب (التثبيت)',
                            title: `تثبيت القريب (${nearRange.pageText})`,
                            meta: `${nearRange.surahText} • ${nearRange.hizbText}`,
                            fromPage: nearStart,
                            toPage: nearEnd,
                            completed: false,
                            quality: 0
                        });
                    }
                }

                // العمود الثالث: المراجعة البعيدة التراكمية (الماضي البعيد)
                const maxMemorizedSoFar = Math.max(cleanStart, cursorPage - 1);
                if (maxMemorizedSoFar >= 5) {
                    const fStart = farCursor > maxMemorizedSoFar ? 1 : farCursor;
                    const fEnd = Math.min(maxMemorizedSoFar, fStart + farReviewPages - 1);
                    const farRange = QuranData.describePageRange(fStart, fEnd, n => formatNumber(n));
                    dayTasks.push({
                        id: uid('tsk'),
                        type: 'far',
                        tag: 'الماضي البعيد (الكبرى)',
                        title: `مراجعة المحفوظ (${farRange.pageText})`,
                        meta: `${farRange.surahText} • ${farRange.hizbText}`,
                        fromPage: fStart,
                        toPage: fEnd,
                        completed: false,
                        quality: 0
                    });
                    farCursor = (fEnd >= maxMemorizedSoFar) ? 1 : (fEnd + 1);
                }
            }

            // إضافة الأعمدة المخصصة الحرة إن اختار المستخدم إضافتها
            if (Array.isArray(customPillars) && customPillars.length > 0) {
                customPillars.forEach(cp => {
                    if (cp && cp.trim()) {
                        dayTasks.push({
                            id: uid('tsk'),
                            type: 'custom',
                            tag: 'بند مخصص',
                            title: cp.trim(),
                            meta: `ضمن ${newRange.surahText}`,
                            fromPage: cursorPage,
                            toPage: todayEndPage,
                            completed: false,
                            quality: 0
                        });
                    }
                });
            }

            days.push({
                id: uid('day'),
                dayNumber: dayCounter++,
                date: currentDate,
                dayType: 'work',
                label: `${newRange.surahText} (${newRange.pageText})`,
                tasks: dayTasks,
                note: ''
            });

            cursorPage = todayEndPage + 1;
            currentDate = addDaysISO(currentDate, 1);
            workDaysInCurrentCycle++;
        }

        return {
            id: uid('plan'),
            title,
            methodology,
            unitType,
            startPage: cleanStart,
            endPage: cleanEnd,
            dailyAmount: Number(dailyAmount) || 1,
            nearReviewWindow: Number(nearReviewWindow) || 5,
            farReviewPages: Number(farReviewPages) || 10,
            workDaysPerWeek: Number(workDaysPerWeek) || 5,
            hasWeeklyReviewDay,
            hasWeeklyRestDay,
            startDate,
            currentDayIndex: 0,
            createdAt: getTodayISO(),
            days
        };
    }

    // ========================================================================
    // 3. بناء الحالة الابتدائية الافتراضية للتطبيق (Initial Default State)
    // ========================================================================
    function createInitialState() {
        // إنشاء خطة افتراضية نموذجية متقنة (حفظ سورة البقرة وآل عمران بالمنهج الثلاثي)
        const starterPlan = generatePlanSchedule({
            title: "مسار الزهراوين (البقرة وآل عمران)",
            methodology: "triple",
            unitType: "page",
            startPage: 1,
            endPage: 76,
            dailyAmount: 1,
            nearReviewWindow: 5,
            farReviewPages: 10,
            workDaysPerWeek: 5,
            hasWeeklyReviewDay: true,
            hasWeeklyRestDay: true,
            customPillars: ["التسميع الذاتي وضبط المتشابهات"],
            startDate: getTodayISO()
        });

        // تهيئة الفاتحة كمتقنة افتراضياً كمثال ترحيبي قابل للتعديل
        const initialMushafPages = {};
        initialMushafPages[1] = {
            status: 'mastered',
            lastReviewed: getTodayISO(),
            notes: 'سورة الفاتحة - أم الكتاب'
        };

        return {
            version: 1,
            settings: {
                numeralSystem: 'arab' // 'arab' (١٢٣) أو 'latn' (123)
            },
            activePlanId: starterPlan.id,
            plans: [starterPlan],
            mushafPages: initialMushafPages,
            mistakes: [
                {
                    id: uid('err'),
                    page: 9,
                    surahName: "البقرة",
                    wordOrAyah: "«فَانفَجَرَتْ مِنْهُ اثْنَتَا عَشْرَةَ عَيْنًا» (الآية ٦٠)",
                    type: "mutashabih",
                    sheikhAdvice: "انتبه لعدم خلطها مع موضع سورة الأعراف «فَانبَجَسَتْ»؛ تذكر أن الفاء في (فانفجرت) مع البقرة.",
                    status: "open",
                    repeatCount: 1,
                    createdAt: getTodayISO()
                }
            ],
            mutashabihat: JSON.parse(JSON.stringify(QuranData.DEFAULT_MUTASHABIHAT)),
            ijazahProfile: {
                sheikhName: "",
                riwayah: "حفص عن عاصم من طريق الشاطبية",
                currentPage: 1,
                startDate: getTodayISO(),
                sanadNotes: ""
            },
            audits: [
                {
                    id: uid('aud'),
                    periodType: "weekly",
                    date: getTodayISO(),
                    rangeText: "الجزء الأول (من ص ١ إلى ص ١٠)",
                    score: 95,
                    strengths: "ثبات ممتاز في رؤوس الآيات ومخارج الحروف.",
                    actionPlan: "التركيز على خواتيم الآيات في القصة الأولى من سورة البقرة."
                }
            ]
        };
    }

    // ========================================================================
    // 4. إدارة الحالة، القراءة، والحفظ الفوري (State Persistence)
    // ========================================================================
    let state = null;

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                state = createInitialState();
                saveState();
                return state;
            }
            const parsed = JSON.parse(raw);
            state = Object.assign(createInitialState(), parsed);
            // ضمان وجود خطة واحدة على الأقل
            if (!Array.isArray(state.plans) || state.plans.length === 0) {
                const defaultState = createInitialState();
                state.plans = defaultState.plans;
                state.activePlanId = state.plans[0].id;
            }
            return state;
        } catch (err) {
            console.error("Error loading TajStorage state, initializing fresh:", err);
            state = createInitialState();
            return state;
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            console.error("Failed to save state to localStorage:", err);
        }
    }

    function getState() {
        if (!state) loadState();
        return state;
    }

    function getActivePlan() {
        const s = getState();
        let plan = s.plans.find(p => p.id === s.activePlanId);
        if (!plan && s.plans.length > 0) {
            plan = s.plans[0];
            s.activePlanId = plan.id;
            saveState();
        }
        return plan || null;
    }

    // ========================================================================
    // 5. دوال معالجة الانقطاع وتكييف الجدول (Rebalance & Buffer Management)
    // ========================================================================

    // الخيار (أ): ترحيل تواريخ الخطة للأمام بعدد معين من الأيام ابتداءً من اليوم الحالي في الخطة
    function shiftPlanDatesForward(planId, daysCount = 1) {
        const plan = getState().plans.find(p => p.id === planId);
        if (!plan) return false;
        const shift = parseInt(daysCount, 10) || 1;
        const startIdx = plan.currentDayIndex || 0;

        for (let i = startIdx; i < plan.days.length; i++) {
            plan.days[i].date = addDaysISO(plan.days[i].date, shift);
        }
        saveState();
        return true;
    }

    // الخيار (ب): استهلاك أقرب يوم احتياط/راحة قادم لامتصاص التأخير دون تغيير تاريخ الختمة النهائي
    function consumeUpcomingRestDay(planId) {
        const plan = getState().plans.find(p => p.id === planId);
        if (!plan) return { success: false, message: "لم يتم العثور على الخطة" };
        const startIdx = plan.currentDayIndex || 0;

        let restIdx = -1;
        for (let i = startIdx + 1; i < plan.days.length; i++) {
            if (plan.days[i].dayType === 'rest') {
                restIdx = i;
                break;
            }
        }

        if (restIdx === -1) {
            return { success: false, message: "لا يوجد يوم راحة قادم في هذه الخطة لاستهلاكه، يمكنك استخدام الترحيل الزمني." };
        }

        // إزالة يوم الراحة القادم وإعادة ترقيم وتأريخ الأيام بسلاسة
        const baseDate = plan.days[startIdx].date;
        plan.days.splice(restIdx, 1);
        for (let i = startIdx; i < plan.days.length; i++) {
            plan.days[i].dayNumber = i + 1;
            plan.days[i].date = addDaysISO(baseDate, i - startIdx);
        }

        saveState();
        return { success: true, message: "تم استهلاك يوم الاحتياط القادم بنجاح وبقي موعد الختمة ثابتاً!" };
    }

    // الخيار (ج): إدراج يوم راحة أو مراجعة طارئ في الموضع الحالي مع إزاحة ما بعده يوماً واحداً
    function insertEmergencyDay(planId, dayType = 'rest', customLabel = '') {
        const plan = getState().plans.find(p => p.id === planId);
        if (!plan) return false;
        const idx = plan.currentDayIndex || 0;
        const currentDayObj = plan.days[idx] || { date: getTodayISO() };

        const newDay = {
            id: uid('day'),
            dayNumber: idx + 1,
            date: currentDayObj.date,
            dayType: dayType, // 'rest' | 'review' | 'work'
            label: customLabel || (dayType === 'rest' ? 'يوم راحة طارئ' : 'يوم تثبيت ومراجعة مخصص'),
            tasks: [
                {
                    id: uid('tsk'),
                    type: dayType === 'rest' ? 'rest' : 'consolidation',
                    tag: dayType === 'rest' ? 'استراحة طارئة' : 'تثبيت مخصص',
                    title: customLabel || (dayType === 'rest' ? 'استراحة ذهنية وتلاوة حرة' : 'مراجعة تثبيتية للمحفوظ السابق'),
                    meta: 'تم إدراجه بمرونة ضمن المسار',
                    fromPage: plan.startPage,
                    toPage: plan.endPage,
                    completed: false,
                    quality: 0
                }
            ],
            note: ''
        };

        plan.days.splice(idx, 0, newDay);

        // تحديث أرقام وتواريخ الأيام التالية
        for (let i = idx; i < plan.days.length; i++) {
            plan.days[i].dayNumber = i + 1;
            if (i > idx) {
                plan.days[i].date = addDaysISO(plan.days[i - 1].date, 1);
            }
        }

        saveState();
        return true;
    }

    // ========================================================================
    // 6. دوال الإحصائيات وحساب نسب الإتقان ومؤشر الالتزام
    // ========================================================================
    function computeGlobalMetrics() {
        const s = getState();
        const pagesMap = s.mushafPages || {};
        let mastered = 0, good = 0, weak = 0;

        for (let p = 1; p <= QuranData.TOTAL_PAGES; p++) {
            const st = pagesMap[p]?.status || 'unmemorized';
            if (st === 'mastered') mastered++;
            else if (st === 'good') good++;
            else if (st === 'weak') weak++;
        }

        const totalMemorized = mastered + good;
        const unmemorized = QuranData.TOTAL_PAGES - (mastered + good + weak);
        const overallPercent = Math.round((totalMemorized / QuranData.TOTAL_PAGES) * 100);

        // حساب أيام الالتزام في الخطة النشطة
        const activePlan = getActivePlan();
        let completedDaysCount = 0;
        let etaDate = '--';

        if (activePlan && activePlan.days.length > 0) {
            completedDaysCount = activePlan.days.filter(d =>
                d.tasks.length > 0 && d.tasks.every(t => t.completed)
            ).length;
            const lastDay = activePlan.days[activePlan.days.length - 1];
            etaDate = lastDay.date;
        }

        return {
            mastered,
            good,
            weak,
            unmemorized,
            totalMemorized,
            overallPercent,
            completedDaysCount,
            etaDate
        };
    }

    // ========================================================================
    // 7. تصدير واستيراد النسخة الاحتياطية (JSON Backup & Restore)
    // ========================================================================
    function exportBackupJSON() {
        const dataStr = JSON.stringify(getState(), null, 2);
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taj-alwaqar-backup-${getTodayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importBackupJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.plans)) {
                return { success: false, message: "ملف النسخة الاحتياطية غير صالح أو لا يتبع صيغة تاج الوقار." };
            }
            state = Object.assign(createInitialState(), parsed);
            saveState();
            return { success: true, message: "تم استرداد خزينة البيانات والخطط بنجاح تام!" };
        } catch (e) {
            return { success: false, message: "تعذر قراءة الملف؛ تأكد من أنه ملف JSON سليم." };
        }
    }

    function resetAllData() {
        state = createInitialState();
        saveState();
        return state;
    }

    // تهيئة أولية عند تحميل الملف
    loadState();

    return {
        uid,
        formatNumber,
        getTodayISO,
        addDaysISO,
        formatArabicDate,
        getState,
        saveState,
        getActivePlan,
        generatePlanSchedule,
        shiftPlanDatesForward,
        consumeUpcomingRestDay,
        insertEmergencyDay,
        computeGlobalMetrics,
        exportBackupJSON,
        importBackupJSON,
        resetAllData
    };
})();