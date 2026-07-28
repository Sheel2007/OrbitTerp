import { useState, useEffect, useRef } from 'react';
import type { CourseResult, Section } from '../types';
import { searchCourses, fetchProfessors } from '../api/client';

interface Props {
  selectedCourses: CourseResult[];
  onAdd: (course: CourseResult) => void;
  onRemove: (courseId: string) => void;
  professorPrefs: Record<string, string>;
  onProfessorChange: (courseId: string, professor: string) => void;
  semester: string;
  onEnroll?: (courseId: string, credits?: string) => void;
  lockedSections?: Section[];
  onRemoveLockedSection?: (sectionId: string) => void;
}

export function CourseSearch({ selectedCourses, onAdd, onRemove, professorPrefs, onProfessorChange, semester, onEnroll, lockedSections = [], onRemoveLockedSection }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [professorLists, setProfessorLists] = useState<Record<string, string[]>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const thisRequest = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await searchCourses(query);
        if (thisRequest === requestIdRef.current) {
          const filtered = data.filter(c =>
            !selectedCourses.some(s => s.course_id === c.course_id) &&
            !lockedSections.some(s => s.course_id === c.course_id)
          );
          setResults(filtered);
          setShowDropdown(filtered.length > 0);
        }
      } catch {
        if (thisRequest === requestIdRef.current) {
          setResults([]);
        }
      }
      if (thisRequest === requestIdRef.current) {
        setLoading(false);
      }
    }, 200);
  }, [query, selectedCourses, lockedSections]);

  useEffect(() => {
    for (const course of selectedCourses) {
      if (!(course.course_id in professorLists)) {
        fetchProfessors(course.course_id, semester).then(profs => {
          setProfessorLists(prev => ({ ...prev, [course.course_id]: profs }));
        });
      }
    }
  }, [selectedCourses, semester]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">Add Courses</label>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Search courses (e.g., CMSC216, Calculus)..."
        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      {loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-t border-gray-700/50 first:border-t-0">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-16 bg-gray-700/60 rounded animate-pulse" />
                <div className="h-3.5 w-36 bg-gray-700/40 rounded animate-pulse" />
              </div>
              <div className="h-3 w-8 bg-gray-700/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map(course => (
            <div key={course.course_id} className="flex items-center hover:bg-gray-700 transition-colors border-t border-gray-700/30 first:border-t-0">
              <button
                onClick={() => {
                  onAdd(course);
                  setQuery('');
                  setShowDropdown(false);
                }}
                className="flex-1 text-left px-4 py-2 text-white flex justify-between items-center min-w-0"
              >
                <span className="truncate">
                  <span className="font-medium text-red-400">{course.course_id}</span>
                  <span className="ml-2 text-gray-300">{course.name}</span>
                </span>
                <span className="text-gray-500 text-sm flex-shrink-0 ml-2">{course.credits} cr</span>
              </button>
              {onEnroll && (
                <button
                  onClick={() => {
                    onEnroll(course.course_id, course.credits);
                    setQuery('');
                    setShowDropdown(false);
                  }}
                  className="px-2.5 self-stretch text-gray-500 hover:text-yellow-400 transition-colors flex-shrink-0 flex items-center border-l border-gray-700/30"
                  title="Already enrolled — pick specific section"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected courses for optimization */}
      {selectedCourses.length > 0 && (
        <div className="space-y-2 mt-3">
          {selectedCourses.map(course => {
            const profs = professorLists[course.course_id] || [];
            const selectedProf = professorPrefs[course.course_id] || '';
            return (
              <div key={course.course_id} className="bg-gray-800/60 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-400">{course.course_id}</span>
                  <div className="flex items-center gap-0.5">
                    {onEnroll && (
                      <button
                        onClick={() => onEnroll(course.course_id, course.credits)}
                        className="text-gray-500 hover:text-yellow-400 transition-colors p-0.5"
                        title="Already enrolled — pick specific section"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(course.course_id)}
                      className="text-gray-500 hover:text-white text-sm"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-1.5">{course.name}</div>
                {!(course.course_id in professorLists) ? (
                  <div className="h-7 w-full bg-gray-700/50 rounded animate-pulse" />
                ) : profs.length > 0 ? (
                  <select
                    value={selectedProf}
                    onChange={e => onProfessorChange(course.course_id, e.target.value)}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="">Any professor</option>
                    {profs.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-gray-500">Instructor: TBA</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Enrolled (locked) sections */}
      {lockedSections.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Enrolled</div>
          <div className="space-y-1.5">
            {lockedSections.map(s => (
              <div key={s.section_id} className="flex items-center justify-between bg-gray-800/50 rounded-md px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    {s.course_id} — {s.section_id.split('-').pop()}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">{s.instructors[0] || 'TBA'}</div>
                </div>
                {onRemoveLockedSection && (
                  <button
                    onClick={() => onRemoveLockedSection(s.section_id)}
                    className="text-gray-500 hover:text-red-400 transition-colors p-0.5 flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
