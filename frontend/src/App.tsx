import { useState, useCallback, useMemo, useEffect } from 'react';
import type { CourseResult, OptimizationRequest, BlockedSlot } from './types';
import { CourseSearch } from './components/CourseSearch';
import { PreferencesForm } from './components/PreferencesForm';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { ScheduleResults } from './components/ScheduleResults';
import { AboutModal } from './components/AboutModal';
import { useOptimizer } from './hooks/useOptimizer';
import { useLocalStorage } from './hooks/useLocalStorage';
import { warmSectionCache, fetchCourseSections } from './api/client';
import type { Section, Meeting } from './types';
import { minutesToTime, DAY_ORDER, COURSE_COLORS } from './utils/timeUtils';

function App() {
  const [selectedCourses, setSelectedCourses] = useLocalStorage<CourseResult[]>('ts:courses', []);
  const [professorPrefs, setProfessorPrefs] = useLocalStorage<Record<string, string>>('ts:profPrefs', {});
  const [semester, setSemester] = useLocalStorage('ts:semester', '202608');
  const [noEarlyMorning, setNoEarlyMorning] = useLocalStorage('ts:noEarly', true);
  const [noEvening, setNoEvening] = useLocalStorage('ts:noEvening', false);
  const [lunchBreak, setLunchBreak] = useLocalStorage('ts:lunch', true);
  const [earlyBefore, setEarlyBefore] = useLocalStorage('ts:earlyBefore', 9);
  const [eveningAfter, setEveningAfter] = useLocalStorage('ts:eveningAfter', 17);
  const [lunchStartHour, setLunchStartHour] = useLocalStorage('ts:lunchStart', 11);
  const [lunchEndHour, setLunchEndHour] = useLocalStorage('ts:lunchEnd', 13);
  const [minGap, setMinGap] = useLocalStorage<number | null>('ts:minGap', null);
  const [maxGap, setMaxGap] = useLocalStorage<number | null>('ts:maxGap', null);
  const [profWeight, setProfWeight] = useLocalStorage('ts:profWeight', 0.4);
  const [gapWeight, setGapWeight] = useLocalStorage('ts:gapWeight', 0.3);
  const [timeWeight, setTimeWeight] = useLocalStorage('ts:timeWeight', 0.3);
  const [daysOff, setDaysOff] = useLocalStorage<string[]>('ts:daysOff', []);
  const [blockedSlotsArray, setBlockedSlotsArray] = useLocalStorage<string[]>('ts:blocked', []);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [previewSection, setPreviewSection] = useState<Section | null>(null);
  const [addSelectedCourse, setAddSelectedCourse] = useState<string | null>(null);
  const [addCourseSections, setAddCourseSections] = useState<Section[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [lockedSections, setLockedSections] = useLocalStorage<Section[]>('ts:locked', []);
  const [lockedCredits, setLockedCredits] = useLocalStorage<Record<string, string>>('ts:lockedCredits', {});

  // Convert stored array to Set for internal use
  const blockedSlots = useMemo(() => new Set(blockedSlotsArray), [blockedSlotsArray]);
  const setBlockedSlots = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setBlockedSlotsArray(prev => {
      const prevSet = new Set(prev);
      const next = updater instanceof Function ? updater(prevSet) : updater;
      return [...next];
    });
  }, [setBlockedSlotsArray]);

  const autoBlockedSlots = useMemo(() => {
    const auto = new Set<string>();
    DAY_ORDER.forEach(day => {
      if (daysOff.includes(day)) {
        for (let h = 8; h <= 21; h++) auto.add(`${day}-${h}`);
        return;
      }
      if (noEarlyMorning) {
        for (let h = 8; h < earlyBefore; h++) auto.add(`${day}-${h}`);
      }
      if (noEvening) {
        for (let h = eveningAfter; h <= 21; h++) auto.add(`${day}-${h}`);
      }
      if (lunchBreak) {
        for (let h = lunchStartHour; h < lunchEndHour; h++) auto.add(`${day}-${h}`);
      }
    });
    return auto;
  }, [noEarlyMorning, noEvening, lunchBreak, earlyBefore, eveningAfter, lunchStartHour, lunchEndHour, daysOff]);

  const allBlockedSlots = useMemo(() => {
    const merged = new Set(blockedSlots);
    autoBlockedSlots.forEach(s => merged.add(s));
    return merged;
  }, [blockedSlots, autoBlockedSlots]);

  const { status, schedules, scheduleLabels, selectedIndex, setSelectedIndex, error, warnings, meta, runOptimize, reset, removeSchedule, updateScheduleSections } = useOptimizer();
  const [allSections, setAllSections] = useLocalStorage<import('./types').Section[]>('ts:allSections', []);

  // Warm cache for all selected courses on mount + semester change
  useEffect(() => {
    selectedCourses.forEach(c => warmSectionCache(c.course_id, semester));
  }, [semester]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCourse = useCallback((course: CourseResult) => {
    setSelectedCourses(prev => {
      if (prev.some(c => c.course_id === course.course_id)) return prev;
      // Pre-warm backend cache — sections + professor ratings fetched in background
      // so optimize is near-instant when user clicks the button
      warmSectionCache(course.course_id, semester);
      return [...prev, course];
    });
  }, [semester]);

  const handleRemoveCourse = useCallback((courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.course_id !== courseId));
    setProfessorPrefs(prev => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  }, []);

  const handleProfessorChange = useCallback((courseId: string, professor: string) => {
    setProfessorPrefs(prev => {
      if (!professor) {
        const next = { ...prev };
        delete next[courseId];
        return next;
      }
      return { ...prev, [courseId]: professor };
    });
  }, []);

  const toggleBlocked = useCallback((key: string) => {
    setBlockedSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  function handleClearAll() {
    if (!window.confirm('Clear all courses, preferences, and results? This cannot be undone.')) return;
    setSelectedCourses([]);
    setProfessorPrefs({});
    setNoEarlyMorning(true);
    setNoEvening(false);
    setLunchBreak(true);
    setEarlyBefore(9);
    setEveningAfter(17);
    setLunchStartHour(11);
    setLunchEndHour(13);
    setMinGap(null);
    setMaxGap(null);
    setProfWeight(0.4);
    setGapWeight(0.3);
    setTimeWeight(0.3);
    setDaysOff([]);
    setBlockedSlots(new Set());
    setLockedSections([]);
    setLockedCredits({});
    reset();
  }

  function handleOptimize() {
    if (selectedCourses.length === 0 && lockedSections.length === 0) return;

    const blocked_times: BlockedSlot[] = [];
    allBlockedSlots.forEach(key => {
      const [day, hourStr] = key.split('-');
      const hour = parseInt(hourStr);
      blocked_times.push({
        day,
        start: `${hour}:00`,
        end: `${hour + 1}:00`,
      });
    });

    const total = profWeight + gapWeight + timeWeight || 1;

    const allCourseIds = [...new Set([
      ...selectedCourses.map(c => c.course_id),
      ...lockedSections.map(s => s.course_id),
    ])];

    const request: OptimizationRequest = {
      course_ids: allCourseIds,
      semester,
      professor_prefs: professorPrefs,
      locked_sections: lockedSections.map(s => s.section_id),
      preferences: {
        blocked_times,
        lunch_window: lunchBreak ? [`${lunchStartHour}:00`, `${lunchEndHour}:00`] : null,
        no_early_morning: noEarlyMorning,
        no_evening: noEvening,
        min_gap: minGap,
        max_gap: maxGap,
      },
      weights: {
        professor_rating: profWeight / total,
        gap_preference: gapWeight / total,
        time_preference: timeWeight / total,
      },
      num_results: 5,
      solver: 'both',
    };

    runOptimize(request);

    // Fetch all available sections in background for manual add feature
    Promise.all(selectedCourses.map(c => fetchCourseSections(c.course_id, semester)))
      .then(results => setAllSections(results.flat()));
  }

  const handleRemoveLockedSection = useCallback((sectionId: string) => {
    setLockedSections(prev => prev.filter(s => s.section_id !== sectionId));
  }, []);

  const handleRemoveSection = useCallback((sectionId: string) => {
    const schedule = schedules[selectedIndex];
    if (!schedule) return;
    const updated = schedule.sections.filter(s => s.section_id !== sectionId);
    if (updated.length === 0) {
      removeSchedule(selectedIndex);
    } else {
      updateScheduleSections(selectedIndex, updated);
    }
  }, [schedules, selectedIndex, updateScheduleSections, removeSchedule]);

  const handleAddSection = useCallback((section: Section) => {
    if (lockedSections.some(s => s.section_id === section.section_id)) return;
    setLockedSections(prev => [...prev, section]);
    closeEnroll();
  }, [lockedSections]);

  const handleSwapSection = useCallback((oldSectionId: string, newSection: Section) => {
    const schedule = schedules[selectedIndex];
    if (!schedule) return;
    const updated = schedule.sections.map(s => s.section_id === oldSectionId ? newSection : s);
    updateScheduleSections(selectedIndex, updated);
    setEditingSection(null);
    setPreviewSection(null);
  }, [schedules, selectedIndex, updateScheduleSections]);

  const handleEditSection = useCallback((section: Section) => {
    setEditingSection(section);
    setPreviewSection(null);
    closeEnroll();
  }, []);

  const editAlternatives = useMemo(() => {
    if (!editingSection) return [];
    const schedule = schedules[selectedIndex];
    if (!schedule) return [];
    const currentIds = new Set(schedule.sections.map(s => s.section_id));
    return allSections.filter(s => s.course_id === editingSection.course_id && !currentIds.has(s.section_id));
  }, [editingSection, schedules, selectedIndex, allSections]);

  const editingColor = useMemo(() => {
    if (!editingSection) return '';
    const schedule = schedules[selectedIndex];
    if (!schedule) return '';
    const uniqueCourses = [...new Set(schedule.sections.map(s => s.course_id))];
    const idx = uniqueCourses.indexOf(editingSection.course_id);
    return COURSE_COLORS[idx >= 0 ? idx % COURSE_COLORS.length : 0];
  }, [editingSection, schedules, selectedIndex]);

  function isAsyncMeeting(m: Meeting): boolean {
    return !m.days || m.days.trim() === '' || (m.start_time === 0 && m.end_time === 0);
  }

  // Fetch sections when enrolled course selected
  useEffect(() => {
    if (!addSelectedCourse) { setAddCourseSections([]); return; }
    setAddLoading(true);
    fetchCourseSections(addSelectedCourse, semester).then(sections => {
      setAddCourseSections(sections);
      setAddLoading(false);
    });
  }, [addSelectedCourse, semester]);

  function closeEnroll() {
    setAddSelectedCourse(null);
    setAddCourseSections([]);
    setPreviewSection(null);
  }

  const handleEnroll = useCallback((courseId: string, credits?: string) => {
    if (credits) setLockedCredits(prev => ({ ...prev, [courseId]: credits }));
    setSelectedCourses(prev => prev.filter(c => c.course_id !== courseId));
    setProfessorPrefs(prev => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
    setAddSelectedCourse(courseId);
    setEditingSection(null);
    setPreviewSection(null);
  }, []);

  const addingColor = useMemo(() => {
    if (!addSelectedCourse) return '';
    const schedule = schedules[selectedIndex];
    const allSects = [...lockedSections, ...(schedule?.sections ?? [])];
    const uniqueCourses = [...new Set(allSects.map(s => s.course_id))];
    const existingIdx = uniqueCourses.indexOf(addSelectedCourse);
    if (existingIdx >= 0) return COURSE_COLORS[existingIdx % COURSE_COLORS.length];
    return COURSE_COLORS[uniqueCourses.length % COURSE_COLORS.length];
  }, [addSelectedCourse, schedules, selectedIndex, lockedSections]);

  const activePreviewColor = editingSection ? editingColor : addingColor;

  const weightTotal = Math.round(profWeight * 100) + Math.round(gapWeight * 100) + Math.round(timeWeight * 100);
  const weightsValid = weightTotal === 100;

  const lockedCourseIds = [...new Set(lockedSections.map(s => s.course_id))];
  const totalCredits = selectedCourses.reduce((sum, c) => {
    const n = parseInt(c.credits);
    return sum + (isNaN(n) ? 0 : n);
  }, 0) + lockedCourseIds.reduce((sum, cid) => {
    if (selectedCourses.some(c => c.course_id === cid)) return sum;
    const n = parseInt(lockedCredits[cid] || '0');
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="min-h-screen md:h-screen bg-gray-950 text-white flex flex-col md:overflow-hidden overflow-auto">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900/80 backdrop-blur z-30">
        <div className="px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <img src="/favicon.svg" alt="OrbitTerp" className="w-7 h-7 flex-shrink-0" />
            <h1 className="text-sm sm:text-base font-bold">OrbitTerp</h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-6 text-sm overflow-x-auto">
            <button
              onClick={() => setAboutOpen(true)}
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base bg-transparent border-none cursor-pointer flex-shrink-0"
            >
              About
            </button>
            <a
              href="https://forms.gle/gu3QN7GNWQkMjaEL8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base flex-shrink-0"
            >
              Feedback
            </a>
            <a
              href="https://github.com/Sheel2007/TestuGen"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base flex-shrink-0 hidden sm:inline"
            >
              GitHub
            </a>
            <span className="text-gray-400 text-sm sm:text-base flex-shrink-0">Credits: <span className="font-semibold text-white">{totalCredits}</span></span>
            <select
              value={semester}
              onChange={e => setSemester(e.target.value)}
              className="px-2 sm:px-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 flex-shrink-0"
            >
              <option value="202608">Fall 2026</option>
              <option value="202601">Spring 2026</option>
              <option value="202508">Fall 2025</option>
              <option value="202501">Spring 2025</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
        {/* Left sidebar — full width on mobile, fixed width on desktop */}
        <aside className="w-full md:w-[320px] flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900/40 md:overflow-y-auto">
          {editingSection ? (
            <div className="p-3 sm:p-4 space-y-3">
              <div className="rounded-lg border border-gray-700 overflow-hidden" style={{ borderColor: editingColor + '60' }}>
                <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: editingColor + '15' }}>
                  <div>
                    <div className="text-sm font-bold text-white">{editingSection.course_id}</div>
                    <div className="text-xs text-gray-400">
                      Current: {editingSection.section_id.split('-').pop()} ({editingSection.instructors[0] || 'TBA'})
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingSection(null); setPreviewSection(null); }}
                    className="text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800 text-xs flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                  </button>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                  {editAlternatives.map(alt => (
                    <button
                      key={alt.section_id}
                      onClick={() => handleSwapSection(editingSection.section_id, alt)}
                      onMouseEnter={() => setPreviewSection(alt)}
                      onMouseLeave={() => setPreviewSection(null)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-800/80 text-xs transition-colors border-t border-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{alt.section_id.split('-').pop()}</span>
                        <span className={alt.open_seats > 0 ? 'text-gray-500' : 'text-red-400'}>
                          {alt.open_seats}/{alt.total_seats}
                          {alt.open_seats === 0 && <span className="ml-1">FULL</span>}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{alt.instructors[0] || 'TBA'}</div>
                      {alt.meetings.filter(m => !isAsyncMeeting(m)).map((m, i) => (
                        <div key={i} className="text-[10px] text-gray-500">
                          {m.days} {minutesToTime(m.start_time)}-{minutesToTime(m.end_time)}
                          {m.building && ` · ${m.building} ${m.room}`}
                        </div>
                      ))}
                      {alt.meetings.every(m => isAsyncMeeting(m)) && (
                        <div className="text-[10px] text-gray-500 uppercase">Online Async</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : addSelectedCourse ? (
            <div className="p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  {addSelectedCourse}
                </div>
                <button
                  onClick={closeEnroll}
                  className="text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800 text-xs flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>
              </div>
              <div className="text-[11px] text-gray-500">Pick the section you're enrolled in</div>
              {addLoading ? (
                <div className="rounded-md border border-gray-700 overflow-hidden">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="px-3 py-2.5 border-t border-gray-800/50 first:border-t-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-10 bg-gray-700/60 rounded animate-pulse" />
                        <div className="h-3 w-12 bg-gray-800/60 rounded animate-pulse" />
                      </div>
                      <div className="h-2.5 w-24 bg-gray-800/50 rounded animate-pulse" />
                      <div className="h-2.5 w-36 bg-gray-800/40 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : addCourseSections.length === 0 ? (
                <div className="text-[11px] text-gray-500 px-1">No sections found</div>
              ) : (
                <div className="overflow-y-auto rounded-md border border-gray-700" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                  {addCourseSections.map(s => (
                    <button
                      key={s.section_id}
                      onClick={() => handleAddSection(s)}
                      onMouseEnter={() => setPreviewSection(s)}
                      onMouseLeave={() => setPreviewSection(null)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-800/80 text-xs transition-colors border-t border-gray-800/50 first:border-t-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{s.section_id.split('-').pop()}</span>
                        <span className={s.open_seats > 0 ? 'text-gray-500' : 'text-red-400'}>
                          {s.open_seats}/{s.total_seats}
                          {s.open_seats === 0 && <span className="ml-1">FULL</span>}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{s.instructors[0] || 'TBA'}</div>
                      {s.meetings.filter(m => !isAsyncMeeting(m)).map((m, i) => (
                        <div key={i} className="text-[10px] text-gray-500">
                          {m.days} {minutesToTime(m.start_time)}-{minutesToTime(m.end_time)}
                          {m.building && ` · ${m.building} ${m.room}`}
                        </div>
                      ))}
                      {s.meetings.every(m => isAsyncMeeting(m)) && (
                        <div className="text-[10px] text-gray-500 uppercase">Online Async</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <div className="p-3 sm:p-4 space-y-4">
            {/* Course search */}
            <CourseSearch
              selectedCourses={selectedCourses}
              onAdd={handleAddCourse}
              onRemove={handleRemoveCourse}
              professorPrefs={professorPrefs}
              onProfessorChange={handleProfessorChange}
              semester={semester}
              onEnroll={handleEnroll}
              lockedSections={lockedSections}
              onRemoveLockedSection={handleRemoveLockedSection}
            />

            {/* Divider */}
            <div className="border-t border-gray-800" />

            {/* Filters */}
            <PreferencesForm
              noEarlyMorning={noEarlyMorning} setNoEarlyMorning={setNoEarlyMorning}
              noEvening={noEvening} setNoEvening={setNoEvening}
              lunchBreak={lunchBreak} setLunchBreak={setLunchBreak}
              earlyBefore={earlyBefore} setEarlyBefore={setEarlyBefore}
              eveningAfter={eveningAfter} setEveningAfter={setEveningAfter}
              lunchStartHour={lunchStartHour} setLunchStartHour={setLunchStartHour}
              lunchEndHour={lunchEndHour} setLunchEndHour={setLunchEndHour}
              minGap={minGap} setMinGap={setMinGap}
              maxGap={maxGap} setMaxGap={setMaxGap}
              profWeight={profWeight} setProfWeight={setProfWeight}
              gapWeight={gapWeight} setGapWeight={setGapWeight}
              timeWeight={timeWeight} setTimeWeight={setTimeWeight}
              weightTotal={weightTotal} weightsValid={weightsValid}
              daysOff={daysOff} setDaysOff={setDaysOff}
              blockedSlots={blockedSlots} toggleBlocked={toggleBlocked}
              autoBlockedSlots={autoBlockedSlots}
            />

            {/* Optimize + Clear buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleOptimize}
                disabled={(selectedCourses.length === 0 && lockedSections.length === 0) || status === 'loading' || !weightsValid}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Optimizing...
                  </>
                ) : (
                  'Optimize Schedule'
                )}
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                title="Clear all"
              >
                Clear
              </button>
            </div>
          </div>
          )}
        </aside>

        {/* Right: schedule tabs + calendar */}
        <div className="flex-1 flex flex-col md:overflow-hidden">
          {/* Warnings & errors — top of main area so users always see them */}
          {(error || warnings.length > 0) && (
            <div className="flex-shrink-0 px-3 sm:px-4 pt-2 space-y-1.5">
              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              {warnings.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2 text-xs text-yellow-300 space-y-0.5">
                  {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Schedule tabs */}
          <ScheduleResults
            schedules={schedules}
            scheduleLabels={scheduleLabels}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onRemove={removeSchedule}
            isAdding={!!addSelectedCourse}
            semester={semester}
            meta={meta}
            loading={status === 'loading'}
          />

          {/* Calendar */}
          <div className="flex-1 overflow-auto p-2 sm:p-4">
            <WeeklyCalendar
              schedule={schedules[selectedIndex] ?? null}
              loading={status === 'loading'}
              courseCount={selectedCourses.length}
              semester={semester}
              onRemoveSection={handleRemoveSection}
              onEditSection={addSelectedCourse ? undefined : handleEditSection}
              previewSection={previewSection}
              previewColor={activePreviewColor}
              allSections={allSections}
              lockedSections={lockedSections}
              onRemoveLockedSection={handleRemoveLockedSection}
            />
          </div>
        </div>
      </div>

      {/* About modal */}
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

export default App;
