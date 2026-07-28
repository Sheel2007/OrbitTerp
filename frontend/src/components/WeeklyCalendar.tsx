import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Schedule, Section, Meeting } from '../types';
import { minutesToTime, parseDays, DAY_ORDER, COURSE_COLORS } from '../utils/timeUtils';
import { fetchCourseDetail } from '../api/client';
import type { CourseDetail } from '../api/client';

function CourseInfoPanel({ section, color, onClose, semester, cachedDetail }: {
  section: Section;
  color: string;
  onClose: () => void;
  semester: string;
  cachedDetail?: CourseDetail;
}) {
  const [detail, setDetail] = useState<CourseDetail | null>(cachedDetail ?? null);
  const loading = !detail;

  useEffect(() => {
    if (cachedDetail) { setDetail(cachedDetail); return; }
    fetchCourseDetail(section.course_id).then(d => { if (d) setDetail(d); });
  }, [section.course_id, cachedDetail]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const sectionNum = section.section_id.split('-').pop();
  const courseId = section.course_id;
  const dept = courseId.replace(/[0-9]/g, '').trim();
  const testudoUrl = `https://app.testudo.umd.edu/soc/${semester}/${dept}/${courseId}`;
  const planetTerpProf = section.instructors[0]
    ? `https://planetterp.com/professor/${encodeURIComponent(section.instructors[0])}`
    : null;

  const rels = detail?.relationships;

  return (
    <div
      className="border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm overflow-y-auto"
      style={{ maxHeight: '45%', borderTop: `3px solid ${color}` }}
    >
      <div className="p-3 sm:p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-bold text-white text-base">{courseId}</span>
              {detail?.name && (
                <span className="text-gray-300 text-sm">- {detail.name}</span>
              )}
              <a
                href={testudoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 hover:text-red-300 text-xs"
              >
                (view on Testudo)
              </a>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {loading ? '...' : `${detail?.credits ?? '?'} credits`} | Section {sectionNum}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Instructor + stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
          <div className="text-sm">
            {planetTerpProf ? (
              <a href={planetTerpProf} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300">
                {section.instructors[0]}
              </a>
            ) : (
              <span className="text-gray-300">TBA</span>
            )}
            {' '}
            <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(section.professor_rating))}</span>
          </div>

          {section.meetings.map((m, i) => (
            <div key={i} className="text-xs text-gray-400">
              {isAsyncMeeting(m) ? (
                <span className="uppercase">Online Async</span>
              ) : (
                <>
                  <span className="font-medium text-gray-300">{m.days}</span>{' '}
                  {minutesToTime(m.start_time)} - {minutesToTime(m.end_time)}
                  {m.building && (
                    <span className="text-gray-500"> in <span className="text-gray-400">{m.building} {m.room}</span></span>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="text-xs text-gray-400">
            {section.open_seats} / {section.total_seats} seats available
          </div>
        </div>

        {/* Relationships */}
        {rels && (
          <div className="space-y-1.5 mb-3">
            {rels.prereqs && (
              <div className="text-xs">
                <span className="text-gray-300 font-medium underline">Prerequisite:</span>{' '}
                <span className="text-gray-400">{rels.prereqs}</span>
              </div>
            )}
            {rels.coreqs && (
              <div className="text-xs">
                <span className="text-gray-300 font-medium underline">Corequisite:</span>{' '}
                <span className="text-gray-400">{rels.coreqs}</span>
              </div>
            )}
            {rels.restrictions && (
              <div className="text-xs">
                <span className="text-gray-300 font-medium underline">Restriction:</span>{' '}
                <span className="text-gray-400">{rels.restrictions}</span>
              </div>
            )}
            {rels.credit_granted_for && (
              <div className="text-xs">
                <span className="text-gray-300 font-medium underline">Credit only granted for:</span>{' '}
                <span className="text-gray-400">{rels.credit_granted_for}</span>
              </div>
            )}
            {rels.also_offered_as && (
              <div className="text-xs">
                <span className="text-gray-300 font-medium underline">Also offered as:</span>{' '}
                <span className="text-gray-400">{rels.also_offered_as}</span>
              </div>
            )}
            {rels.formerly && (
              <div className="text-xs">
                <span className="text-gray-300 font-medium underline">Formerly:</span>{' '}
                <span className="text-gray-400">{rels.formerly}</span>
              </div>
            )}
          </div>
        )}

        {/* Gen Eds */}
        {detail?.gen_ed && detail.gen_ed.length > 0 && (
          <div className="text-xs mb-3">
            <span className="text-gray-300 font-medium">Gen Ed: </span>
            <span className="text-gray-400">{detail.gen_ed.flat().join(', ')}</span>
          </div>
        )}

        {/* Description */}
        {loading ? (
          <div className="h-10 rounded bg-gray-800 animate-pulse" />
        ) : detail?.description ? (
          <p className="text-xs text-gray-400 leading-relaxed">{detail.description}</p>
        ) : null}
      </div>
    </div>
  );
}

interface Props {
  schedule: Schedule | null;
  loading?: boolean;
  courseCount?: number;
  semester?: string;
  onRemoveSection?: (sectionId: string) => void;
  onEditSection?: (section: Section) => void;
  previewSection?: Section | null;
  previewColor?: string;
  allSections?: Section[];
  lockedSections?: Section[];
  onRemoveLockedSection?: (sectionId: string) => void;
}

const START_HOUR = 8;
const END_HOUR = 22;

const DAY_LABELS_FULL: Record<string, string> = { M: 'Mon', Tu: 'Tue', W: 'Wed', Th: 'Thu', F: 'Fri', Other: 'Other' };
const DAY_LABELS_SHORT: Record<string, string> = { M: 'M', Tu: 'T', W: 'W', Th: 'R', F: 'F', Other: '~' };

/** A meeting is async if it has no days or zero start/end time */
function isAsyncMeeting(m: Meeting): boolean {
  return !m.days || m.days.trim() === '' || (m.start_time === 0 && m.end_time === 0);
}

/** Check if a section is fully async (all meetings async) */
function isAsyncSection(s: Section): boolean {
  return s.meetings.length > 0 && s.meetings.every(isAsyncMeeting);
}

// Skeleton block templates — realistic UMD schedule patterns
const SKELETON_TEMPLATES = [
  { days: ['M', 'W', 'F'], start: 540, duration: 50 },
  { days: ['M', 'W', 'F'], start: 600, duration: 50 },
  { days: ['M', 'W', 'F'], start: 660, duration: 50 },
  { days: ['M', 'W', 'F'], start: 780, duration: 50 },
  { days: ['M', 'W', 'F'], start: 840, duration: 50 },
  { days: ['Tu', 'Th'], start: 570, duration: 75 },
  { days: ['Tu', 'Th'], start: 690, duration: 75 },
  { days: ['Tu', 'Th'], start: 810, duration: 75 },
  { days: ['Tu', 'Th'], start: 930, duration: 75 },
];

function generateSkeletonBlocks(courseCount: number) {
  const blocks: { day: string; start: number; duration: number; colorIdx: number }[] = [];
  let mwfIdx = 0;
  let tuthIdx = 5;

  for (let c = 0; c < Math.min(courseCount, 8); c++) {
    const template = c % 2 === 0
      ? SKELETON_TEMPLATES[mwfIdx++ % 5]
      : SKELETON_TEMPLATES[tuthIdx++ < 9 ? tuthIdx - 1 : 5 + ((tuthIdx - 5) % 4)];

    if (!template) continue;

    for (const day of template.days) {
      blocks.push({ day, start: template.start, duration: template.duration, colorIdx: c });
    }
  }
  return blocks;
}

function CalendarGrid({ hourHeight, timeColWidth, hasOtherCol, children, otherContent }: {
  hourHeight: number;
  timeColWidth: number;
  hasOtherCol: boolean;
  children?: (day: string) => React.ReactNode;
  otherContent?: React.ReactNode;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const dayCols = hasOtherCol ? 6 : 5;
  const columns = hasOtherCol ? [...DAY_ORDER, 'Other'] : DAY_ORDER;

  return (
    <div className="h-full min-w-0">
      {/* Day headers */}
      <div
        className="grid border-b border-gray-800 sticky top-0 bg-gray-950 z-10"
        style={{ gridTemplateColumns: `${timeColWidth}px repeat(${dayCols}, 1fr)` }}
      >
        <div />
        {columns.map(day => (
          <div key={day} className={`py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-medium border-l border-gray-800 ${day === 'Other' ? 'text-gray-500 bg-gray-900/40' : 'text-gray-400'}`}>
            <span className="hidden sm:inline">{DAY_LABELS_FULL[day]}</span>
            <span className="sm:hidden">{DAY_LABELS_SHORT[day]}</span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `${timeColWidth}px repeat(${dayCols}, 1fr)`, height: `${hours.length * hourHeight}px` }}
      >
        {/* Hour labels */}
        <div className="relative">
          {hours.map(h => (
            <div
              key={h}
              className="absolute w-full text-right pr-1 sm:pr-2 text-[8px] sm:text-[10px] text-gray-600"
              style={{ top: `${(h - START_HOUR) * hourHeight}px`, height: hourHeight }}
            >
              {h > 12 ? h - 12 : h}<span className="hidden sm:inline">{h >= 12 ? ' PM' : ' AM'}</span><span className="sm:hidden">{h >= 12 ? 'p' : 'a'}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAY_ORDER.map(day => (
          <div key={day} className="relative border-l border-gray-800/60">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full border-t border-gray-800/40"
                style={{ top: `${(h - START_HOUR) * hourHeight}px`, height: hourHeight }}
              />
            ))}
            {children?.(day)}
          </div>
        ))}

        {/* Other column for async */}
        {hasOtherCol && (
          <div className="relative border-l border-gray-800/60 bg-gray-900/20">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full border-t border-gray-800/20"
                style={{ top: `${(h - START_HOUR) * hourHeight}px`, height: hourHeight }}
              />
            ))}
            {otherContent}
          </div>
        )}
      </div>
    </div>
  );
}

export function WeeklyCalendar({ schedule, loading = false, courseCount = 4, semester = '', onRemoveSection, onEditSection, previewSection, previewColor, allSections = [], lockedSections = [], onRemoveLockedSection }: Props) {
  const hourHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 40 : 56;
  const timeColWidth = typeof window !== 'undefined' && window.innerWidth < 640 ? 32 : 50;

  const skeletonBlocks = useMemo(
    () => generateSkeletonBlocks(courseCount),
    [courseCount]
  );

  const [popupData, setPopupData] = useState<{ section: Section; color: string } | null>(null);
  const handleCardClick = useCallback((e: React.MouseEvent, section: Section, color: string) => {
    e.stopPropagation();
    setPopupData({ section, color });
  }, []);

  const hasAlternatives = useCallback((section: Section) => {
    if (!schedule) return false;
    const currentIds = new Set(schedule.sections.map(s => s.section_id));
    return allSections.some(s => s.course_id === section.course_id && !currentIds.has(s.section_id));
  }, [schedule, allSections]);

  // Prefetch course details for all courses in schedule
  const [detailCache, setDetailCache] = useState<Record<string, CourseDetail>>({});
  useEffect(() => {
    if (!schedule) return;
    const courseIds = [...new Set(schedule.sections.map(s => s.course_id))];
    const missing = courseIds.filter(id => !detailCache[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map(id => fetchCourseDetail(id).then(d => [id, d] as const))).then(results => {
      setDetailCache(prev => {
        const next = { ...prev };
        for (const [id, d] of results) { if (d) next[id] = d; }
        return next;
      });
    });
  }, [schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed timer for loading messages
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  // Combine schedule sections + locked sections for display
  const displaySections = useMemo(() => {
    const scheduleSects = schedule?.sections ?? [];
    const lockedIds = new Set(lockedSections.map(s => s.section_id));
    const fromSchedule = scheduleSects.filter(s => !lockedIds.has(s.section_id));
    return [...lockedSections, ...fromSchedule];
  }, [schedule, lockedSections]);

  // Compute overlap layout: for each day, assign column index + total columns to each block
  type BlockLayout = { colIndex: number; totalCols: number };
  const overlapLayout = useMemo(() => {
    if (displaySections.length === 0 && !previewSection) return {};
    const layout: Record<string, Record<string, BlockLayout>> = {};

    for (const day of DAY_ORDER) {
      const blocks: { key: string; start: number; end: number }[] = [];

      for (const section of displaySections) {
        section.meetings
          .filter(m => !isAsyncMeeting(m) && parseDays(m.days).includes(day))
          .forEach((m, midx) => {
            blocks.push({ key: `${section.section_id}-${midx}`, start: m.start_time, end: m.end_time });
          });
      }

      if (previewSection && previewColor) {
        previewSection.meetings
          .filter(m => !isAsyncMeeting(m) && parseDays(m.days).includes(day))
          .forEach((m, midx) => {
            blocks.push({ key: `preview-${previewSection.section_id}-${midx}`, start: m.start_time, end: m.end_time });
          });
      }

      blocks.sort((a, b) => a.start - b.start || a.end - b.end);

      const cols: { end: number }[] = [];
      const assigned: Record<string, number> = {};
      for (const block of blocks) {
        let placed = -1;
        for (let c = 0; c < cols.length; c++) {
          if (cols[c].end <= block.start) { placed = c; break; }
        }
        if (placed === -1) { placed = cols.length; cols.push({ end: 0 }); }
        cols[placed].end = block.end;
        assigned[block.key] = placed;
      }

      const groups: number[][] = [];
      const visited = new Set<number>();
      for (let i = 0; i < blocks.length; i++) {
        if (visited.has(i)) continue;
        const group = [i];
        visited.add(i);
        let maxEnd = blocks[i].end;
        for (let j = i + 1; j < blocks.length; j++) {
          if (blocks[j].start < maxEnd) {
            group.push(j);
            visited.add(j);
            maxEnd = Math.max(maxEnd, blocks[j].end);
          }
        }
        groups.push(group);
      }

      const dayLayout: Record<string, BlockLayout> = {};
      for (const group of groups) {
        const totalCols = Math.max(...group.map(i => assigned[blocks[i].key])) + 1;
        for (const i of group) {
          dayLayout[blocks[i].key] = { colIndex: assigned[blocks[i].key], totalCols };
        }
      }
      layout[day] = dayLayout;
    }
    return layout;
  }, [displaySections, previewSection, previewColor]);

  // Skeleton loading state
  if (loading) {
    const loadingMessage =
      elapsed < 5  ? 'Fetching course sections...' :
      elapsed < 15 ? 'Gathering professor ratings...' :
      elapsed < 30 ? 'Running quantum optimization...' :
      elapsed < 60 ? 'This can take a minute — finding the best schedules...' :
                      'Almost there — hang tight, optimizing across all sections...';

    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-3 sm:px-4 py-2.5 flex items-center gap-3">
          <div className="relative w-5 h-5 flex-shrink-0">
            <svg className="animate-spin w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 font-medium truncate">{loadingMessage}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`} elapsed
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <CalendarGrid hourHeight={hourHeight} timeColWidth={timeColWidth} hasOtherCol={false}>
            {(day) => (
              <>
                {skeletonBlocks
                  .filter(b => b.day === day)
                  .map((block, i) => {
                    const top = ((block.start - START_HOUR * 60) / 60) * hourHeight;
                    const height = (block.duration / 60) * hourHeight;
                    return (
                      <div
                        key={`skel-${day}-${i}`}
                        className="absolute left-0.5 right-0.5 rounded overflow-hidden"
                        style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                      >
                        <div
                          className="w-full h-full rounded animate-pulse"
                          style={{
                            backgroundColor: COURSE_COLORS[block.colorIdx % COURSE_COLORS.length] + '15',
                            borderLeft: `3px solid ${COURSE_COLORS[block.colorIdx % COURSE_COLORS.length]}30`,
                          }}
                        >
                          <div className="p-1 sm:px-1.5 sm:py-1 space-y-1">
                            <div className="h-2.5 sm:h-3 rounded-sm w-3/4" style={{ backgroundColor: COURSE_COLORS[block.colorIdx % COURSE_COLORS.length] + '20' }} />
                            {height > 30 && (
                              <div className="h-2 rounded-sm w-1/2" style={{ backgroundColor: COURSE_COLORS[block.colorIdx % COURSE_COLORS.length] + '12' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </CalendarGrid>
        </div>
      </div>
    );
  }

  // Empty state — only show if no schedule AND no locked sections AND no preview
  if (!schedule && lockedSections.length === 0 && !previewSection) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="max-w-sm text-center space-y-6">
          <div>
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Get Started</h2>
            <p className="text-gray-500 text-xs">Build your ideal schedule in a few steps</p>
          </div>
          <div className="space-y-3 text-left">
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Search for courses</p>
                <p className="text-xs text-gray-500">Type a course name or ID (e.g. CMSC216) in the search bar. Click to add it for optimization</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Lock enrolled sections</p>
                <p className="text-xs text-gray-500">Already registered? Click the lock icon next to a search result to pick your exact section — the optimizer builds around it</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Set preferences & optimize</p>
                <p className="text-xs text-gray-500">Block out times, pick preferred professors, then hit Optimize to find the best schedules</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Edit, compare & export</p>
                <p className="text-xs text-gray-500">Swap individual sections, browse top schedules, then export to Google Calendar, Apple Calendar, or Outlook</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Real schedule or locked-only — separate async vs timed sections
  const lockedIds = new Set(lockedSections.map(s => s.section_id));
  const courseColors: Record<string, string> = {};
  const uniqueCourses = [...new Set(displaySections.map(s => s.course_id))];
  uniqueCourses.forEach((cid, i) => {
    courseColors[cid] = COURSE_COLORS[i % COURSE_COLORS.length];
  });


  // Collect async sections (all meetings have no days / zero times)
  const asyncSections = displaySections.filter(isAsyncSection);
  const hasOtherCol = asyncSections.length > 0;

  // For timed sections, also check for individual async meetings within a section
  // that has some timed meetings (rare but possible)

  const otherContent = hasOtherCol ? (
    <div className="absolute inset-0 p-0.5 space-y-1 overflow-y-auto">
      {asyncSections.map((section) => {
        const color = courseColors[section.course_id];
        const cardHeight = Math.max(hourHeight * 1.2, 65);
        return (
          <div
            key={`async-${section.section_id}`}
            onClick={(e) => handleCardClick(e, section, color)}
            className="relative rounded px-1 sm:px-1.5 py-1 overflow-hidden cursor-pointer group/card transition-all hover:brightness-125 hover:shadow-lg"
            style={{
              height: `${cardHeight}px`,
              backgroundColor: color + '25',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div className="absolute top-0 right-0.5 flex items-center gap-0 z-10">
              {onEditSection && hasAlternatives(section) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPopupData(null); onEditSection(section); }}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-0.5 opacity-0 group-hover/card:opacity-100"
                  title="Edit section"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
              {onRemoveSection && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveSection(section.section_id); }}
                  className="text-base font-bold text-gray-400 hover:text-red-400 transition-colors p-0.5 leading-none opacity-0 group-hover/card:opacity-100"
                >
                  &times;
                </button>
              )}
            </div>
            <div className="text-[9px] sm:text-[11px] font-semibold text-white truncate leading-tight">
              {section.course_id}
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-400 truncate leading-tight">
              {section.instructors[0] || 'TBA'}
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 truncate leading-tight uppercase">
              Online Async
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 truncate leading-tight">
              {section.section_id.split('-').pop()}
            </div>
          </div>
        );
      })}
    </div>
  ) : undefined;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <CalendarGrid hourHeight={hourHeight} timeColWidth={timeColWidth} hasOtherCol={hasOtherCol} otherContent={otherContent}>
          {(day) => (
            <>
              {displaySections.map((section) =>
                section.meetings
                  .filter(m => !isAsyncMeeting(m) && parseDays(m.days).includes(day))
                  .map((meeting, midx) => {
                    const top = ((meeting.start_time - START_HOUR * 60) / 60) * hourHeight;
                    const height = ((meeting.end_time - meeting.start_time) / 60) * hourHeight;
                    const color = courseColors[section.course_id];
                    const isLocked = lockedIds.has(section.section_id);
                    const blockKey = `${section.section_id}-${midx}`;
                    const layout = overlapLayout[day]?.[blockKey];
                    const colIndex = layout?.colIndex ?? 0;
                    const totalCols = layout?.totalCols ?? 1;
                    const leftPct = (colIndex / totalCols) * 100;
                    const widthPct = (1 / totalCols) * 100;

                    return (
                      <div
                        key={blockKey}
                        onClick={(e) => handleCardClick(e, section, color)}
                        className={`absolute rounded px-0.5 sm:px-1.5 py-0.5 overflow-hidden cursor-pointer group/card transition-all hover:z-10 hover:brightness-125 hover:shadow-lg ${isLocked ? 'border border-dashed' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 20)}px`,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          backgroundColor: color + '30',
                          borderLeft: `3px solid ${color}`,
                          ...(isLocked ? { borderColor: color + '80' } : {}),
                        }}
                      >
                        <div className="absolute top-0 right-0.5 flex items-center gap-0 z-10">
                          {isLocked && onRemoveLockedSection && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveLockedSection(section.section_id); }}
                              className="text-base font-bold text-gray-400 hover:text-red-400 transition-colors p-0.5 leading-none opacity-0 group-hover/card:opacity-100"
                            >
                              &times;
                            </button>
                          )}
                          {!isLocked && onEditSection && hasAlternatives(section) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPopupData(null); onEditSection(section); }}
                              className="text-gray-400 hover:text-blue-400 transition-colors p-0.5 opacity-0 group-hover/card:opacity-100"
                              title="Edit section"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          {!isLocked && onRemoveSection && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveSection(section.section_id); }}
                              className="text-base font-bold text-gray-400 hover:text-red-400 transition-colors p-0.5 leading-none opacity-0 group-hover/card:opacity-100"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                        <div className="text-[9px] sm:text-[11px] font-semibold text-white truncate leading-tight flex items-center gap-0.5">
                          {isLocked && (
                            <svg className="w-2.5 h-2.5 flex-shrink-0 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {section.course_id}
                        </div>
                        {height > 25 && (
                          <div className="text-[8px] sm:text-[9px] text-gray-300 truncate leading-tight">
                            {section.section_id.split('-').pop()} · {meeting.building} {meeting.room}
                          </div>
                        )}
                        {height > 35 && section.instructors.length > 0 && (
                          <div className="hidden sm:block text-[9px] text-gray-400 truncate leading-tight">
                            {section.instructors[0]}
                          </div>
                        )}
                        {height > 48 && (
                          <div className="hidden sm:block text-[9px] text-gray-500 truncate leading-tight">
                            {minutesToTime(meeting.start_time)} - {minutesToTime(meeting.end_time)}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
              {/* Preview ghost blocks for hovered alternative */}
              {previewSection && previewColor && previewSection.meetings
                .filter(m => !isAsyncMeeting(m) && parseDays(m.days).includes(day))
                .map((meeting, midx) => {
                  const top = ((meeting.start_time - START_HOUR * 60) / 60) * hourHeight;
                  const height = ((meeting.end_time - meeting.start_time) / 60) * hourHeight;
                  const previewKey = `preview-${previewSection.section_id}-${midx}`;
                  const layout = overlapLayout[day]?.[previewKey];
                  const colIndex = layout?.colIndex ?? 0;
                  const totalCols = layout?.totalCols ?? 1;
                  const leftPct = (colIndex / totalCols) * 100;
                  const widthPct = (1 / totalCols) * 100;
                  return (
                    <div
                      key={previewKey}
                      className="absolute rounded px-0.5 sm:px-1.5 py-0.5 pointer-events-none z-20 border-2 border-dashed"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 20)}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: previewColor + '18',
                        borderColor: previewColor + '80',
                      }}
                    >
                      <div className="text-[9px] sm:text-[11px] font-semibold truncate leading-tight" style={{ color: previewColor }}>
                        {previewSection.course_id}
                      </div>
                      {height > 25 && (
                        <div className="text-[8px] sm:text-[9px] truncate leading-tight" style={{ color: previewColor + 'AA' }}>
                          {previewSection.section_id.split('-').pop()} · {previewSection.instructors[0] || 'TBA'}
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </>
          )}
        </CalendarGrid>
      </div>

      {popupData && (
        <CourseInfoPanel
          section={popupData.section}
          color={popupData.color}
          semester={semester}
          onClose={() => setPopupData(null)}
          cachedDetail={detailCache[popupData.section.course_id]}
        />
      )}
    </div>
  );
}
