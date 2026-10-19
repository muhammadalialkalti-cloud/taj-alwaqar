/* ============================================================================
   تَاج الوَقَار (TAJ AL-WAQAR) - ROYAL INTERACTIVE CONTROLLER (app.js)
   المهمة: ربط الواجهات، محرك التنقل، تفاعل الأوراد، والتحرير الحر المطلق
   ============================================================================ */

const app = (() => {
    let currentTab = 'tab-dashboard';
    let mushafViewMode = 'pages'; // 'pages' أو 'juz'
    let mushafGridFilter = 'all';  // 'all' | 'mastered' | 'good' | 'weak' | 'unmemorized'
    let logbookSubtab = 'mistakes'; // 'mistakes' | 'mutashabihat' | 'ijazah'
    let auditPeriod = 'weekly';     // 'weekly' | 'monthly' | 'comprehensive'

    // ========================================================================
    // 1. دورة الحياة والتشغيل الأولي
    // ========================================================================
    function init() {
        const state = TajStorage.getState();
        applyNumeralSystemUI(state.settings.numeralSystem);
        
        // التحقق هل هناك خطة نشطة، إن لم توجد عيّن الأولى
        const activePlan = TajStorage.getActivePlan();
        if (activePlan && activePlan.days.length > 0) {
            // ضمان أن مؤشر اليوم ضمن الحدود
            if (activePlan.currentDayIndex >= activePlan.days.length) {
                activePlan.currentDayIndex = activePlan.days.length - 1;
            }
        }

        renderAll();
    }

    function enterMihrab() {
        const splash = document.getElementById('splash-screen');
        const container = document.getElementById('app-container');
        if (splash) splash.classList.add('hidden');
        if (container) container.classList.remove('hidden');
        renderAll();
    }

    function showSplash() {
        const splash = document.getElementById('splash-screen');
        const container = document.getElementById('app-container');
        if (splash) splash.classList.remove('hidden');
        if (container) container.classList.add('hidden');
        updateSplashStats();
    }

    function updateSplashStats() {
        const metrics = TajStorage.computeGlobalMetrics();
        const el = document.getElementById('splash-total-progress');
        if (el) {
            el.textContent = TajStorage.formatNumber(metrics.overallPercent) + '٪';
        }
    }

    // ========================================================================
    // 2. محرك التنقل بين التبويبات (Tab Switching Engine)
    // ========================================================================
    function switchTab(tabId) {
        currentTab = tabId;
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));

        const targetPane = document.getElementById(tabId);
        if (targetPane) targetPane.classList.add('active');

        const targetNav = document.querySelector(`.bnav-item[data-tab="${tabId}"]`);
        if (targetNav) targetNav.classList.add('active');

        // تحديث عنوان الشريط العلوي
        const titles = {
            'tab-dashboard': 'المحراب اليومي',
            'tab-plans': 'هندسة الخطط والمسارات',
            'tab-mushaf': 'خريطة إتقان المصحف',
            'tab-logbook': 'سجل المقرأة والمتشابهات',
            'tab-analytics': 'الميزان والتقييم الدوري'
        };
        const titleEl = document.getElementById('active-view-title');
        if (titleEl) titleEl.textContent = titles[tabId] || 'تاج الوقار';

        renderAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderAll() {
        updateHeaderDate();
        renderDashboard();
        renderPlansTab();
        renderMushafTab();
        renderLogbookTab();
        renderAnalyticsTab();
    }

    function updateHeaderDate() {
        const dateEl = document.getElementById('header-date-display');
        if (dateEl) {
            dateEl.textContent = TajStorage.formatArabicDate(TajStorage.getTodayISO(), true);
        }
    }

    // ========================================================================
    // 3. محرك الأرقام العالمي (١٢٣ / 123)
    // ========================================================================
    function toggleNumeralSystem() {
        const state = TajStorage.getState();
        state.settings.numeralSystem = (state.settings.numeralSystem === 'arab') ? 'latn' : 'arab';
        TajStorage.saveState();
        applyNumeralSystemUI(state.settings.numeralSystem);
        renderAll();
        showToast(state.settings.numeralSystem === 'arab' ? 'تم تفعيل الأرقام العربية المشرقية (١٢٣)' : 'تم تفعيل الأرقام اللاتينية (123)');
    }

    function applyNumeralSystemUI(system) {
        document.body.setAttribute('data-num-system', system);
        const badge = document.getElementById('num-system-badge');
        if (badge) {
            badge.textContent = (system === 'arab') ? '١٢٣' : '123';
        }
    }

    // ========================================================================
    // 4. رندر التبويب الأول: المحراب اليومي (Dashboard Renderer)
    // ========================================================================
    function renderDashboard() {
        const state = TajStorage.getState();
        const activePlan = TajStorage.getActivePlan();
        
        // تعبئة قائمة اختيار الخطط في الهيدر اليومي
        const planSelect = document.getElementById('dashboard-plan-select');
        if (planSelect) {
            planSelect.innerHTML = state.plans.map(p => `
                <option value="${p.id}" ${p.id === state.activePlanId ? 'selected' : ''}>${p.title}</option>
            `).join('');
        }

        const metrics = TajStorage.computeGlobalMetrics();

        // تحديث شريط القيادة اليومية
        const pctEl = document.getElementById('daily-percent-text');
        const fillRing = document.getElementById('daily-ring-fill');
        const streakEl = document.getElementById('metric-streak-days');
        const pagesEl = document.getElementById('metric-memorized-pages');
        const etaEl = document.getElementById('metric-eta-date');

        if (streakEl) streakEl.textContent = TajStorage.formatNumber(metrics.completedDaysCount);
        if (pagesEl) pagesEl.textContent = TajStorage.formatNumber(metrics.totalMemorized);
        if (etaEl) etaEl.textContent = TajStorage.formatNumber(metrics.etaDate);

        if (!activePlan || activePlan.days.length === 0) {
            if (pctEl) pctEl.textContent = '٠٪';
            if (fillRing) fillRing.style.strokeDashoffset = '263.89';
            const tasksContainer = document.getElementById('daily-pillars-container');
            if (tasksContainer) {
                tasksContainer.innerHTML = `
                    <div class="pillar-card" style="text-align:center; padding:24px;">
                        <p>لا توجد خطة مفعلة حالياً. انتقل إلى تبويب "الخطط" لإنشاء مسارك الأول.</p>
                        <button class="btn-primary-gold" style="margin-top:12px;" onclick="app.switchTab('tab-plans')">إنشاء مسار جديد</button>
                    </div>
                `;
            }
            return;
        }

        const dayIdx = activePlan.currentDayIndex || 0;
        const currentDayObj = activePlan.days[dayIdx] || activePlan.days[0];

        // شارة نوع اليوم
        const badgeType = document.getElementById('today-day-type-badge');
        if (badgeType) {
            if (currentDayObj.dayType === 'review') {
                badgeType.className = 'status-badge badge-review';
                badgeType.textContent = 'يوم مراجعة وتثبيت';
            } else if (currentDayObj.dayType === 'rest') {
                badgeType.className = 'status-badge badge-rest';
                badgeType.textContent = 'يوم راحة واحتياط';
            } else {
                badgeType.className = 'status-badge badge-work';
                badgeType.textContent = 'يوم إنجاز وعمل';
            }
        }

        // عنوان اليوم في النافذة
        const titleBox = document.getElementById('current-plan-day-title');
        const subBox = document.getElementById('current-plan-day-subtitle');
        if (titleBox) titleBox.textContent = `اليوم ${TajStorage.formatNumber(currentDayObj.dayNumber)} من ${TajStorage.formatNumber(activePlan.days.length)}`;
        if (subBox) subBox.textContent = currentDayObj.label;

        // حساب نسبة الإنجاز لليوم الحالي
        const tasks = currentDayObj.tasks || [];
        const completedCount = tasks.filter(t => t.completed).length;
        const dayPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

        if (pctEl) pctEl.textContent = TajStorage.formatNumber(dayPct) + '٪';
        if (fillRing) {
            const circumference = 263.89;
            const offset = circumference - (dayPct / 100) * circumference;
            fillRing.style.strokeDashoffset = offset;
        }

        // رسم بطاقات المهام والأعمدة اليومية
        const tasksContainer = document.getElementById('daily-pillars-container');
        if (tasksContainer) {
            if (tasks.length === 0) {
                tasksContainer.innerHTML = `<div class="pillar-card"><p style="text-align:center;">لا توجد مهام مسجلة لهذا اليوم.</p></div>`;
            } else {
                tasksContainer.innerHTML = tasks.map((task, tIdx) => `
                    <div class="pillar-card ${task.completed ? 'completed' : ''} pillar-${task.type || 'new'}">
                        <div class="pillar-top">
                            <div>
                                <span class="pillar-type-tag">${task.tag || 'ورد يومي'}</span>
                                <h4 class="pillar-title">${task.title}</h4>
                                <p class="pillar-meta">${task.meta}</p>
                            </div>
                            <button class="pillar-check-btn" onclick="app.toggleTaskCompleted('${activePlan.id}', ${dayIdx}, ${tIdx})" title="وضع إشارة إتمام">
                                ✓
                            </button>
                        </div>
                        <div class="pillar-controls-bar">
                            <div class="quality-stars">
                                <span style="font-size:0.72rem; color:var(--text-muted); margin-left:4px;">الجودة:</span>
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <button class="q-star-btn ${task.quality >= star ? 'active' : ''}" onclick="app.setTaskQuality('${activePlan.id}', ${dayIdx},${tIdx}, ${star})" title="تقييم الإتقان ${star}/5">
                                        ${TajStorage.formatNumber(star)}★
                                    </button>
                                `).join('')}
                            </div>
                            <div class="pillar-mini-actions">
                                <button class="p-mini-btn" onclick="app.openQuickErrorModal(${task.fromPage || 1}, '${task.title}')">+ تسجيل خطأ مقرأة</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // خاطرة التدبر اليومية
        const noteInput = document.getElementById('daily-reflection-input');
        if (noteInput && document.activeElement !== noteInput) {
            noteInput.value = currentDayObj.note || '';
        }
    }

    function switchActivePlan(planId) {
        const state = TajStorage.getState();
        state.activePlanId = planId;
        TajStorage.saveState();
        renderAll();
        showToast('تم تفعيل المسار بنجاح');
    }

    function navigatePlanDay(direction) {
        const activePlan = TajStorage.getActivePlan();
        if (!activePlan) return;
        let newIdx = (activePlan.currentDayIndex || 0) + direction;
        if (newIdx < 0) newIdx = 0;
        if (newIdx >= activePlan.days.length) newIdx = activePlan.days.length - 1;

        activePlan.currentDayIndex = newIdx;
        TajStorage.saveState();
        renderDashboard();
    }

    function toggleTaskCompleted(planId, dayIdx, taskIdx) {
        const plan = TajStorage.getState().plans.find(p => p.id === planId);
        if (!plan || !plan.days[dayIdx] || !plan.days[dayIdx].tasks[taskIdx]) return;

        const task = plan.days[dayIdx].tasks[taskIdx];
        task.completed = !task.completed;
        if (task.completed && task.quality === 0) {
            task.quality = 4; // تقييم افتراضي عند الإتمام
        }
        TajStorage.saveState();
        renderDashboard();
    }

    function setTaskQuality(planId, dayIdx, taskIdx, qualityValue) {
        const plan = TajStorage.getState().plans.find(p => p.id === planId);
        if (!plan || !plan.days[dayIdx] || !plan.days[dayIdx].tasks[taskIdx]) return;

        const task = plan.days[dayIdx].tasks[taskIdx];
        task.quality = qualityValue;
        task.completed = true; // تعيين الإتمام تلقائياً مع التقييم
        TajStorage.saveState();
        renderDashboard();
    }

    function saveDailyNote() {
        const activePlan = TajStorage.getActivePlan();
        if (!activePlan) return;
        const dayIdx = activePlan.currentDayIndex || 0;
        const input = document.getElementById('daily-reflection-input');
        if (input && activePlan.days[dayIdx]) {
            activePlan.days[dayIdx].note = input.value;
            TajStorage.saveState();
            showToast('تم حفظ الخاطرة والملاحظة بنجاح');
        }
    }

    // ========================================================================
    // 5. رندر التبويب الثاني: هندسة الخطط والمسارات (Plans Tab)
    // ========================================================================
    function renderPlansTab() {
        const state = TajStorage.getState();
        const grid = document.getElementById('plans-cards-grid');
        if (grid) {
            grid.innerHTML = state.plans.map(p => `
                <div class="plan-item-card ${p.id === state.activePlanId ? 'active-plan' : ''}" onclick="app.switchActivePlan('${p.id}')">
                    <div class="plan-card-head">
                        <span class="plan-card-title">${p.title}</span>
                        <span class="status-badge ${p.id === state.activePlanId ? 'badge-work' : 'badge-rest'}">
                            ${p.id === state.activePlanId ? 'نشط الآن' : 'محفوظ'}
                        </span>
                    </div>
                    <div class="plan-card-details">
                        النطاق: ص ${TajStorage.formatNumber(p.startPage)} ⬅ ص ${TajStorage.formatNumber(p.endPage)} • ${TajStorage.formatNumber(p.days.length)} يوماً
                    </div>
                    <div class="plan-card-footer">
                        <span style="font-size:0.72rem; color:var(--text-muted);">البدء: ${p.startDate}</span>
                        <button class="btn-outline-gold btn-sm" onclick="event.stopPropagation(); app.deletePlan('${p.id}')">حذف المسار</button>
                    </div>
                </div>
            `).join('');
        }

        renderScheduleTable();
    }

    function renderScheduleTable() {
        const activePlan = TajStorage.getActivePlan();
        const container = document.getElementById('plan-schedule-list');
        const filterSelect = document.getElementById('schedule-filter-select');
        const filterVal = filterSelect ? filterSelect.value : 'all';

        if (!container || !activePlan) return;

        let days = activePlan.days || [];
        if (filterVal === 'pending') {
            days = days.filter(d => !d.tasks.every(t => t.completed));
        } else if (filterVal === 'completed') {
            days = days.filter(d => d.tasks.length > 0 && d.tasks.every(t => t.completed));
        } else if (filterVal === 'review') {
            days = days.filter(d => d.dayType === 'review' || d.dayType === 'rest');
        }

        if (days.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد أيام مطابقة للفلتر المحدد.</p>`;
            return;
        }

        container.innerHTML = days.map((day) => {
            const isDone = day.tasks.length > 0 && day.tasks.every(t => t.completed);
            const isCurrent = (activePlan.days[activePlan.currentDayIndex || 0]?.id === day.id);

            let rowClass = '';
            if (isDone) rowClass = 'day-done';
            if (isCurrent) rowClass = 'day-current';
            if (day.dayType === 'rest') rowClass = 'day-rest-row';

            return `
                <div class="schedule-day-row ${rowClass}">
                    <div>
                        <strong style="color:var(--gold-bright); font-size:0.88rem;">اليوم ${TajStorage.formatNumber(day.dayNumber)}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">(${day.date})</span>
                        <div style="font-size:0.82rem; color:var(--text-parchment); margin-top:2px;">${day.label}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="status-badge ${day.dayType === 'work' ? 'badge-work' : day.dayType === 'review' ? 'badge-review' : 'badge-rest'}">
                            ${day.dayType === 'work' ? 'إنجاز' : day.dayType === 'review' ? 'مراجعة' : 'راحة'}
                        </span>
                        <button class="btn-outline-gold btn-sm" onclick="app.jumpToPlanDay('${activePlan.id}', '${day.id}')">انتقل إليه</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function jumpToPlanDay(planId, dayId) {
        const plan = TajStorage.getState().plans.find(p => p.id === planId);
        if (!plan) return;
        const targetIdx = plan.days.findIndex(d => d.id === dayId);
        if (targetIdx !== -1) {
            plan.currentDayIndex = targetIdx;
            TajStorage.saveState();
            switchTab('tab-dashboard');
            showToast(`تم الانتقال لليوم ${TajStorage.formatNumber(targetIdx + 1)}`);
        }
    }

    function deletePlan(planId) {
        const state = TajStorage.getState();
        if (state.plans.length <= 1) {
            showToast('لا يمكنك حذف المسار الوحيد المتبقي.');
            return;
        }
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا المسار نهائياً؟')) {
            state.plans = state.plans.filter(p => p.id !== planId);
            if (state.activePlanId === planId) {
                state.activePlanId = state.plans[0].id;
            }
            TajStorage.saveState();
            renderAll();
            showToast('تم حذف المسار بنجاح');
        }
    }

    // ========================================================================
    // 6. رندر التبويب الثالث: خريطة المصحف الحرارية (Mushaf Tab)
    // ========================================================================
    function setMushafViewMode(mode) {
        mushafViewMode = mode;
        document.getElementById('mview-pages-btn').classList.toggle('active', mode === 'pages');
        document.getElementById('mview-juz-btn').classList.toggle('active', mode === 'juz');
        renderMushafTab();
    }

    function filterMushafGrid(statusKey) {
        mushafGridFilter = statusKey;
        renderMushafTab();
    }

    function renderMushafTab() {
        const state = TajStorage.getState();
        const pagesMap = state.mushafPages || {};

        let masteredCount = 0, goodCount = 0, weakCount = 0, unmemCount = 0;
        for (let p = 1; p <= 604; p++) {
            const st = pagesMap[p]?.status || 'unmemorized';
            if (st === 'mastered') masteredCount++;
            else if (st === 'good') goodCount++;
            else if (st === 'weak') weakCount++;
            else unmemCount++;
        }

        const setC = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = TajStorage.formatNumber(val); };
        setC('count-all-pages', 604);
        setC('count-mastered-pages', masteredCount);
        setC('count-good-pages', goodCount);
        setC('count-weak-pages', weakCount);
        setC('count-unmemorized-pages', unmemCount);

        const container = document.getElementById('mushaf-heatmap-container');
        if (!container) return;

        if (mushafViewMode === 'pages') {
            let html = '<div class="pages-heatmap-grid">';
            for (let p = 1; p <= 604; p++) {
                const info = pagesMap[p] || { status: 'unmemorized' };
                const st = info.status;

                if (mushafGridFilter !== 'all' && st !== mushafGridFilter) {
                    continue;
                }

                html += `
                    <div class="page-cell status-${st}" onclick="app.openPageDetailModal(${p})" title="صفحة ${TajStorage.formatNumber(p)} - الحالة: ${st}">
                        <span>${TajStorage.formatNumber(p)}</span>
                    </div>
                `;
            }
            html += '</div>';
            container.innerHTML = html;
        } else {
            // عرض الأجزاء الثلاثين
            let html = '<div class="juz-cards-grid">';
            for (let j = 1; j <= 30; j++) {
                const jBounds = QuranData.getJuzBounds(j);
                let jMastered = 0;
                for (let p = jBounds.startPage; p <= jBounds.endPage; p++) {
                    if (pagesMap[p]?.status === 'mastered' || pagesMap[p]?.status === 'good') {
                        jMastered++;
                    }
                }
                const jPct = Math.round((jMastered / jBounds.totalPages) * 100);

                html += `
                    <div class="juz-card-block" onclick="app.openJuzDetailModal(${j})">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:var(--gold-bright); font-size:0.9rem;">الجزء ${TajStorage.formatNumber(j)}</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${TajStorage.formatNumber(jPct)}٪</span>
                        </div>
                        <p style="font-size:0.75rem; color:var(--text-secondary);">${jBounds.name}</p>
                        <div class="juz-bar-track">
                            <div class="juz-bar-fill" style="width: ${jPct}%;"></div>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
            container.innerHTML = html;
        }
    }

    function applyBulkPageStatus() {
        const fromInput = document.getElementById('bulk-from-page');
        const toInput = document.getElementById('bulk-to-page');
        const statusSelect = document.getElementById('bulk-status-select');
        if (!fromInput || !toInput || !statusSelect) return;

        const fromP = parseInt(fromInput.value, 10) || 1;
        const toP = parseInt(toInput.value, 10) || 1;
        const statusVal = statusSelect.value;
        const state = TajStorage.getState();

        const start = Math.min(fromP, toP);
        const end = Math.max(fromP, toP);

        for (let p = start; p <= end; p++) {
            if (!state.mushafPages[p]) state.mushafPages[p] = {};
            state.mushafPages[p].status = statusVal;
            state.mushafPages[p].lastReviewed = TajStorage.getTodayISO();
        }

        TajStorage.saveState();
        renderAll();
        showToast(`تم تحديث الصفحات من ${TajStorage.formatNumber(start)} إلى ${TajStorage.formatNumber(end)} بنجاح`);
    }

    // ========================================================================
    // 7. رندر التبويب الرابع: سجل المقرأة والمتشابهات والإجازة (Logbook Tab)
    // ========================================================================
    function switchLogbookSubtab(subtabId) {
        logbookSubtab = subtabId;
        ['mistakes', 'mutashabihat', 'ijazah'].forEach(id => {
            const btn = document.getElementById(`subtab-btn-${id}`);
            const pane = document.getElementById(`logbook-sub-${id}`);
            if (btn) btn.classList.toggle('active', id === subtabId);
            if (pane) pane.classList.toggle('hidden', id !== subtabId);
        });
        renderLogbookTab();
    }

    function renderLogbookTab() {
        if (logbookSubtab === 'mistakes') {
            renderMistakesList();
        } else if (logbookSubtab === 'mutashabihat') {
            renderMutashabihatList();
        } else if (logbookSubtab === 'ijazah') {
            renderIjazahFolio();
        }
    }

    function renderMistakesList() {
        const state = TajStorage.getState();
        const container = document.getElementById('mistakes-list-container');
        const searchInput = document.getElementById('mistake-search-input');
        const typeFilter = document.getElementById('mistake-type-filter');
        const statusFilter = document.getElementById('mistake-status-filter');
        if (!container) return;

        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const tVal = typeFilter ? typeFilter.value : 'all';
        const sVal = statusFilter ? statusFilter.value : 'all';

        let list = state.mistakes || [];
        if (q) {
            list = list.filter(m => 
                (m.wordOrAyah && m.wordOrAyah.toLowerCase().includes(q)) ||
                (m.surahName && m.surahName.toLowerCase().includes(q)) ||
                (m.sheikhAdvice && m.sheikhAdvice.toLowerCase().includes(q))
            );
        }
        if (tVal !== 'all') list = list.filter(m => m.type === tVal);
        if (sVal !== 'all') list = list.filter(m => m.status === sVal);

        if (list.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد أخطاء مسجلة مطابقة للبحث.</p>`;
            return;
        }

        const typeLabels = {
            'forget': 'نسيان وتفلت',
            'tashkeel': 'تشكيل وبنية',
            'tajweed': 'حكم تجويدي',
            'mutashabih': 'متشابهات',
            'waqf': 'وقف وابتداء'
        };

        container.innerHTML = list.map(m => `
            <div class="log-entry-card ${m.status === 'resolved' ? 'resolved' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                    <div>
                        <span class="status-badge ${m.status === 'resolved' ? 'badge-work' : 'badge-review'}">
                            ${m.status === 'resolved' ? 'تم الضبط والإتقان' : 'قيد التكرار والعلاج'}
                        </span>
                        <h4 style="font-size:1.02rem; color:var(--text-parchment); margin-top:6px;">${m.wordOrAyah}</h4>
                        <p style="font-size:0.78rem; color:var(--gold-soft); margin-top:2px;">
                            سورة ${m.surahName} • ص ${TajStorage.formatNumber(m.page)} • التصنيف: ${typeLabels[m.type] || m.type}
                        </p>
                    </div>
                    <button class="btn-outline-gold btn-sm" onclick="app.toggleMistakeStatus('${m.id}')">
                        ${m.status === 'resolved' ? 'إعادة فتح' : 'تم الضبط ✓'}
                    </button>
                </div>
                ${m.sheikhAdvice ? `
                    <div class="sheikh-advice-box">
                        <strong>نصيحة الشيخ والتوجيه:</strong> ${m.sheikhAdvice}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    function toggleMistakeStatus(id) {
        const state = TajStorage.getState();
        const m = state.mistakes.find(x => x.id === id);
        if (m) {
            m.status = m.status === 'resolved' ? 'open' : 'resolved';
            TajStorage.saveState();
            renderMistakesList();
            showToast('تم تحديث حالة التنبيه بنجاح');
        }
    }

    function renderMutashabihatList() {
        const state = TajStorage.getState();
        const container = document.getElementById('mutashabihat-list-container');
        if (!container) return;

        const list = state.mutashabihat || [];
        if (list.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد قواعد متشابهات مسجلة.</p>`;
            return;
        }

        container.innerHTML = list.map(item => `
            <div class="log-entry-card">
                <h4 style="color:var(--gold-bright); font-size:1rem; margin-bottom:4px;">${item.title}</h4>
                <p style="font-size:0.84rem; color:var(--text-parchment); margin-bottom:6px;">${item.verses}</p>
                <div class="sheikh-advice-box">
                    <strong>الضابط الذهبي:</strong> ${item.rule}
                </div>
            </div>
        `).join('');
    }

    function renderIjazahFolio() {
        const state = TajStorage.getState();
        const p = state.ijazahProfile || {};
        const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setV('ijazah-sheikh-name', p.sheikhName);
        setV('ijazah-riwayah', p.riwayah);
        setV('ijazah-current-page', p.currentPage);
        setV('ijazah-start-date', p.startDate);
        setV('ijazah-sanad-notes', p.sanadNotes);
    }

    function saveIjazahProfile() {
        const state = TajStorage.getState();
        state.ijazahProfile = {
            sheikhName: document.getElementById('ijazah-sheikh-name')?.value || '',
            riwayah: document.getElementById('ijazah-riwayah')?.value || '',
            currentPage: parseInt(document.getElementById('ijazah-current-page')?.value, 10) || 1,
            startDate: document.getElementById('ijazah-start-date')?.value || TajStorage.getTodayISO(),
            sanadNotes: document.getElementById('ijazah-sanad-notes')?.value || ''
        };
        TajStorage.saveState();
        showToast('تم حفظ وثيقة الإجازة والسند بنجاح');
    }

    // ========================================================================
    // 8. رندر التبويب الخامس: الميزان والتقييم الدوري (Analytics Tab)
    // ========================================================================
    function setAuditPeriod(period) {
        auditPeriod = period;
        document.querySelectorAll('.period-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-period') === period);
        });
        renderAnalyticsTab();
    }

    function renderAnalyticsTab() {
        const metrics = TajStorage.computeGlobalMetrics();
        const kpiGrid = document.getElementById('analytics-kpi-grid');
        if (kpiGrid) {
            kpiGrid.innerHTML = `
                <div class="kpi-card">
                    <span class="kpi-value">${TajStorage.formatNumber(metrics.overallPercent)}٪</span>
                    <span class="kpi-label">معدل الإتقان الكلي</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-value">${TajStorage.formatNumber(metrics.mastered)}</span>
                    <span class="kpi-label">صفحة متقنة راسخة</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-value">${TajStorage.formatNumber(metrics.completedDaysCount)}</span>
                    <span class="kpi-label">أيام التزام متواصل</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-value">${TajStorage.formatNumber(metrics.weak)}</span>
                    <span class="kpi-label">صفحات تحتاج تثبيت</span>
                </div>
            `;
        }

        const state = TajStorage.getState();
        const auditsContainer = document.getElementById('audits-history-list');
        if (auditsContainer) {
            const audits = (state.audits || []).filter(a => a.periodType === auditPeriod || auditPeriod === 'comprehensive');
            if (audits.length === 0) {
                auditsContainer.innerHTML = `<p style="text-align:center; padding:15px; color:var(--text-muted);">لا توجد جلسات تقييم مسجلة لهذه الفترة.</p>`;
            } else {
                auditsContainer.innerHTML = audits.map(a => `
                    <div class="audit-item-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="color:var(--gold-bright); font-size:0.9rem;">${a.rangeText}</strong>
                            <span class="status-badge badge-work">درجة الإتقان: ${TajStorage.formatNumber(a.score)}٪</span>
                        </div>
                        <p style="font-size:0.82rem; color:var(--text-parchment);"><strong>نقاط القوة:</strong> ${a.strengths}</p>
                        <p style="font-size:0.82rem; color:var(--moss-light); margin-top:2px;"><strong>خطة المعالجة:</strong> ${a.actionPlan}</p>
                    </div>
                `).join('');
            }
        }
    }

    // ========================================================================
    // 9. نظام النوافذ المنبثقة الشامل للتحرير الحر (Dynamic Modals)
    // ========================================================================
    function openModal(title, htmlContent) {
        const backdrop = document.getElementById('modal-backdrop');
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body-content');
        if (backdrop && titleEl && bodyEl) {
            titleEl.textContent = title;
            bodyEl.innerHTML = htmlContent;
            backdrop.classList.remove('hidden');
        }
    }

    function closeModal() {
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) backdrop.classList.add('hidden');
    }

    function handleBackdropClick(event) {
        if (event.target.id === 'modal-backdrop') {
            closeModal();
        }
    }

    // النافذة أ: إنشاء مسار جديد
    function openPlanBuilderModal() {
        openModal("صياغة مسار حفظ وإتقان جديد", `
            <div class="form-group">
                <label>عنوان المسار</label>
                <input type="text" id="modal-plan-title" class="royal-input" value="مسار الحفظ الجديد">
            </div>
            <div class="form-group">
                <label>المنهجية المتبعة</label>
                <select id="modal-plan-methodology" class="royal-select-sm">
                    <option value="triple">المنهج الثلاثي الراسخ (حفظ جديد + تثبيت قريب + مراجعة كبرى)</option>
                    <option value="flexible">المنهج المرن المخصص</option>
                </select>
            </div>
            <div class="form-group">
                <label>صفحة البداية في مصحف المدينة (١ - ٦٠٤)</label>
                <input type="number" id="modal-plan-start" class="royal-input" min="1" max="604" value="77">
            </div>
            <div class="form-group">
                <label>صفحة النهاية في مصحف المدينة (١ - ٦٠٤)</label>
                <input type="number" id="modal-plan-end" class="royal-input" min="1" max="604" value="106">
            </div>
            <div class="form-group">
                <label>مقدار الإنجاز اليومي (صفحات)</label>
                <input type="number" id="modal-plan-amount" class="royal-input" min="1" max="20" value="1">
            </div>
            <div class="modal-footer-btns">
                <button class="btn-outline-gold btn-sm" onclick="app.closeModal()">إلغاء</button>
                <button class="btn-primary-gold" onclick="app.submitNewPlan()">توليد المسار وبدء العمل</button>
            </div>
        `);
    }

    function submitNewPlan() {
        const title = document.getElementById('modal-plan-title')?.value || 'مسار جديد';
        const methodology = document.getElementById('modal-plan-methodology')?.value || 'triple';
        const startPage = parseInt(document.getElementById('modal-plan-start')?.value, 10) || 1;
        const endPage = parseInt(document.getElementById('modal-plan-end')?.value, 10) || 604;
        const dailyAmount = parseInt(document.getElementById('modal-plan-amount')?.value, 10) || 1;

        const newPlan = TajStorage.generatePlanSchedule({
            title,
            methodology,
            unitType: 'page',
            startPage,
            endPage,
            dailyAmount,
            workDaysPerWeek: 5,
            hasWeeklyReviewDay: true,
            hasWeeklyRestDay: true,
            startDate: TajStorage.getTodayISO()
        });

        const state = TajStorage.getState();
        state.plans.push(newPlan);
        state.activePlanId = newPlan.id;
        TajStorage.saveState();
        closeModal();
        renderAll();
        showToast('تم صياغة المسار وتوليد جدوله الواقعي بنجاح تام');
    }

    // النافذة ب: معالجة الانقطاع والتعثر (Rebalance Modal)
    function openRebalanceModal() {
        const activePlan = TajStorage.getActivePlan();
        if (!activePlan) {
            showToast('لا توجد خطة نشطة حالياً.');
            return;
        }

        openModal("معالجة انقطاع أو تكييف الجدول", `
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">
                حصل ظرف طارئ وانقطعت عن الحفظ؟ اختر الطريقة الهندسية الأنسب لامتصاص التعثر دون إحباط:
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-outline-gold" style="justify-content:flex-start; text-align:right;" onclick="app.executeRebalance('shift')">
                    <strong>1. الترحيل الزمني للأمام:</strong> دفع تاريخ الختمة يوماً أو يومين دون مراكمة أوراد جديدة.
                </button>
                <button class="btn-outline-gold" style="justify-content:flex-start; text-align:right;" onclick="app.executeRebalance('consumeRest')">
                    <strong>2. استهلاك يوم الاحتياط القادم:</strong> إلغاء يوم الراحة القادم للتعويض مع إبقاء موعد الختمة النهائي ثابتاً.
                </button>
                <button class="btn-outline-gold" style="justify-content:flex-start; text-align:right;" onclick="app.executeRebalance('insertRest')">
                    <strong>3. إدراج يوم راحة طارئ:</strong> إضافة استراحة ذهنية اليوم وإزاحة ما بعده يوماً واحداً.
                </button>
            </div>
        `);
    }

    function executeRebalance(actionType) {
        const activePlan = TajStorage.getActivePlan();
        if (!activePlan) return;

        if (actionType === 'shift') {
            TajStorage.shiftPlanDatesForward(activePlan.id, 1);
            showToast('تم ترحيل تواريخ الخطة يوماً للأمام بنجاح');
        } else if (actionType === 'consumeRest') {
            const res = TajStorage.consumeUpcomingRestDay(activePlan.id);
            showToast(res.message);
        } else if (actionType === 'insertRest') {
            TajStorage.insertEmergencyDay(activePlan.id, 'rest', 'يوم راحة طارئ لاستعادة النشاط');
            showToast('تم إدراج يوم الراحة الطارئ بنجاح');
        }

        closeModal();
        renderAll();
    }

    // النافذة ج: تسجيل خطأ مقرأة سريع
    function openQuickErrorModal(defaultPage = 1, defaultSurah = '') {
        openModal("تدوين خطأ أو تنبيه من المقرأة", `
            <div class="form-group">
                <label>رقم الصفحة في مصحف المدينة</label>
                <input type="number" id="modal-err-page" class="royal-input" min="1" max="604" value="${defaultPage}">
            </div>
            <div class="form-group">
                <label>اسم السورة</label>
                <input type="text" id="modal-err-surah" class="royal-input" value="${defaultSurah}">
            </div>
            <div class="form-group">
                <label>الكلمة أو الآية التي حصل فيها الخطأ</label>
                <input type="text" id="modal-err-word" class="royal-input" placeholder="مثال: «فَانفَجَرَتْ» بدل «فانبجست»">
            </div>
            <div class="form-group">
                <label>تصنيف الخطأ</label>
                <select id="modal-err-type" class="royal-select-sm">
                    <option value="mutashabih">لبس في المتشابهات</option>
                    <option value="forget">نسيان وتفلت</option>
                    <option value="tashkeel">تشكيل وبنية كلمة</option>
                    <option value="tajweed">حكم تجويدي ومخارج</option>
                    <option value="waqf">وقف وابتداء</option>
                </select>
            </div>
            <div class="form-group">
                <label>نصيحة الشيخ والتوجيه لتصحيحه</label>
                <textarea id="modal-err-advice" rows="3" class="royal-input" placeholder="اكتب ملاحظة الشيخ وكيف ضبطها..."></textarea>
            </div>
            <div class="modal-footer-btns">
                <button class="btn-outline-gold btn-sm" onclick="app.closeModal()">إلغاء</button>
                <button class="btn-primary-gold" onclick="app.submitNewMistake()">حفظ في سجل المقرأة</button>
            </div>
        `);
    }

    function submitNewMistake() {
        const page = parseInt(document.getElementById('modal-err-page')?.value, 10) || 1;
        const surahName = document.getElementById('modal-err-surah')?.value || 'البقرة';
        const wordOrAyah = document.getElementById('modal-err-word')?.value || 'موضع غير محدد';
        const type = document.getElementById('modal-err-type')?.value || 'mutashabih';
        const sheikhAdvice = document.getElementById('modal-err-advice')?.value || '';

        const state = TajStorage.getState();
        state.mistakes.unshift({
            id: TajStorage.uid('err'),
            page,
            surahName,
            wordOrAyah,
            type,
            sheikhAdvice,
            status: 'open',
            repeatCount: 1,
            createdAt: TajStorage.getTodayISO()
        });

        TajStorage.saveState();
        closeModal();
        renderLogbookTab();
        showToast('تم حفظ التنبيه في سجل المقرأة بنجاح');
    }

    // النافذة د: خزينة البيانات والنسخ الاحتياطي (Vault Modal)
    function openVaultModal() {
        openModal("خزينة البيانات والنسخ الاحتياطي (Local-First)", `
            <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.6;">
                جميع بياناتك، خططك، ومسارات حفظك محفوظة محلياً على جهازك بأمان تام. يمكنك تصدير نسخة احتياطية بملف JSON أو استيرادها في أي وقت.
            </p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:14px;">
                <button class="btn-primary-gold" onclick="TajStorage.exportBackupJSON(); showToast('تم تنزيل ملف النسخة الاحتياطية بنجاح');">
                    تصدير نسخة احتياطية (JSON)
                </button>
                <label class="btn-outline-gold" style="display:flex; align-items:center; justify-content:center; cursor:pointer; padding:10px;">
                    استيراد نسخة احتياطية
                    <input type="file" accept=".json" style="display:none;" onchange="app.handleImportFile(event)">
                </label>
                <button class="btn-outline-gold" style="border-color:var(--status-weak-light); color:var(--status-weak-light);" onclick="app.confirmResetData()">
                    إعادة ضبط المصنع وحذف البيانات
                </button>
            </div>
        `);
    }

    function handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const res = TajStorage.importBackupJSON(e.target.result);
            showToast(res.message);
            if (res.success) {
                closeModal();
                renderAll();
            }
        };
        reader.readAsText(file);
    }

    function confirmResetData() {
        if (confirm('تحذير: هل أنت متأكد من رغبتك في حذف جميع البيانات وإعادة التطبيق لحالته الأولى؟')) {
            TajStorage.resetAllData();
            closeModal();
            renderAll();
            showToast('تمت إعادة ضبط التطبيق بنجاح');
        }
    }

    // النافذة هـ: تفاصيل الصفحة في المصحف
    function openPageDetailModal(pageNumber) {
        const state = TajStorage.getState();
        const info = QuranData.getPageMetadata(pageNumber);
        const pageData = state.mushafPages[pageNumber] || { status: 'unmemorized', notes: '' };

        openModal(`صفحة رقم ${TajStorage.formatNumber(pageNumber)}`, `
            <div style="background:var(--bg-elevated); padding:12px; border-radius:var(--radius-sm); margin-bottom:10px;">
                <p style="font-size:0.88rem; color:var(--gold-bright);"><strong>النطاق:</strong> ${info.surahNamesText}</p>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">الجزء ${TajStorage.formatNumber(info.juz)} • الحزب ${TajStorage.formatNumber(info.hizb)} (${info.rubLabel})</p>
            </div>
            <div class="form-group">
                <label>حالة الإتقان والضبط</label>
                <select id="modal-page-status" class="royal-select-sm">
                    <option value="mastered" ${pageData.status === 'mastered' ? 'selected' : ''}>متقن راسخ</option>
                    <option value="good" ${pageData.status === 'good' ? 'selected' : ''}>محفوظ جيد</option>
                    <option value="weak" ${pageData.status === 'weak' ? 'selected' : ''}>يحتاج تثبيت / تفلت</option>
                    <option value="unmemorized" ${pageData.status === 'unmemorized' ? 'selected' : ''}>غير محفوظ</option>
                </select>
            </div>
            <div class="form-group">
                <label>ملاحظات خاصة بالصفحة</label>
                <textarea id="modal-page-notes" rows="3" class="royal-input" placeholder="دوّن هنا أي ملاحظة تخص وجه هذه الصفحة...">${pageData.notes || ''}</textarea>
            </div>
            <div class="modal-footer-btns">
                <button class="btn-outline-gold btn-sm" onclick="app.closeModal()">إلغاء</button>
                <button class="btn-primary-gold" onclick="app.savePageDetail(${pageNumber})">حفظ حالة الصفحة</button>
            </div>
        `);
    }

    function savePageDetail(pageNumber) {
        const statusVal = document.getElementById('modal-page-status')?.value || 'unmemorized';
        const notesVal = document.getElementById('modal-page-notes')?.value || '';
        const state = TajStorage.getState();

        if (!state.mushafPages[pageNumber]) state.mushafPages[pageNumber] = {};
        state.mushafPages[pageNumber].status = statusVal;
        state.mushafPages[pageNumber].notes = notesVal;
        state.mushafPages[pageNumber].lastReviewed = TajStorage.getTodayISO();

        TajStorage.saveState();
        closeModal();
        renderMushafTab();
        showToast(`تم حفظ بيانات الصفحة ${TajStorage.formatNumber(pageNumber)} بنجاح`);
    }

    // النافذة و: دليل الاستخدام الشامل
    function openGuideModal() {
        openModal("دليل استخدام «تَاج الوَقَار»", `
            <div style="font-size:0.84rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:10px; line-height:1.6;">
                <p><strong style="color:var(--gold-bright);">1. المحراب اليومي:</strong> يمثل ورك اليومي الموزع على المنهج الثلاثي (حفظ جديد، تثبيت قريب، ومراجعة كبرى). بضغطة زر تسجل الإتقان وتحدد درجة الجودة (1-5 نجوم).</p>
                <p><strong style="color:var(--gold-bright);">2. هندسة الخطط:</strong> يمكنك صياغة عدة مسارات والتنقل بينها بحرية، مع تحرير كامل لكل يوم وتغيير مواعيد الراحة.</p>
                <p><strong style="color:var(--gold-bright);">3. خريطة المصحف:</strong> شبكة الـ 604 صفحات تعرض حالتك الحرارية بدقة، مع أداة تلوين وتحديث جماعي لأي نطاق.</p>
                <p><strong style="color:var(--gold-bright);">4. المقرأة والمتشابهات:</strong> سجل فوري للأخطاء مع نصيحة الشيخ وضوابط المتشابهات البيانية.</p>
                <p><strong style="color:var(--gold-bright);">5. الخصوصية:</strong> التطبيق يعمل محلياً 100% بدون إنترنت مع خيار النسخ الاحتياطي الفوري.</p>
            </div>
        `);
    }

    // نظام الإشعارات الفورية (Toasts)
    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.innerHTML = `<span>${message}</span><span>❖</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // تشغيل التطبيق فور تحميل المستند
    document.addEventListener('DOMContentLoaded', init);

    return {
        init,
        enterMihrab,
        showSplash,
        switchTab,
        toggleNumeralSystem,
        switchActivePlan,
        navigatePlanDay,
        toggleTaskCompleted,
        setTaskQuality,
        saveDailyNote,
        renderScheduleTable,
        jumpToPlanDay,
        deletePlan,
        setMushafViewMode,
        filterMushafGrid,
        applyBulkPageStatus,
        switchLogbookSubtab,
        renderMistakesList,
        toggleMistakeStatus,
        saveIjazahProfile,
        setAuditPeriod,
        openModal,
        closeModal,
        handleBackdropClick,
        openPlanBuilderModal,
        submitNewPlan,
        openRebalanceModal,
        executeRebalance,
        openQuickErrorModal,
        submitNewMistake,
        openVaultModal,
        handleImportFile,
        confirmResetData,
        openPageDetailModal,
        savePageDetail,
        openGuideModal,
        showToast
    };
})();