import React, { useState } from 'react';
import { IconUserPlus, IconTrash2, IconChevronRight } from './Icons';
import { DateInput } from './DateInput';
import { getLawEra, getDisplayRelation } from '../engine/utils';
import { REL_TYPES, createPerson } from '../engine/graphModel';

/** 관계 역할에 따른 한글 라벨 */
const ROLE_OPTIONS = [
  { value: 'wife', label: '처' },
  { value: 'husband', label: '남편' },
  { value: 'son', label: '자녀(아들)' },
  { value: 'daughter', label: '자녀(딸)' },
  { value: 'sibling', label: '형제자매' },
];

/**
 * 탭별 피상속인 상속인 입력 패널
 */
const DeceasedTabPanel = ({
  deceasedPerson,
  graphData,
  onUpdatePerson,
  onAddHeir,
  onRemoveHeir,
  onUpdateRelationship,
  onKeyDown,
  rootDeathDate,
  sourcePersonName = '',
}) => {
  const { people = [], relationships = [] } = graphData;

  if (!deceasedPerson) return null;

  const lawEra = getLawEra(deceasedPerson.deathDate || rootDeathDate);

  // 이 피상속인의 상속인 관계 목록
  const heirRels = relationships.filter(r => r.parentId === deceasedPerson.id);
  const heirPersons = heirRels
    .map(r => {
      const p = people.find(per => per.id === r.childId);
      return p ? { ...p, relRole: r.role, relType: r.type } : null;
    })
    .filter(Boolean);

  const handleAddNewHeir = () => {
    onAddHeir(deceasedPerson.id, { name: '', isDeceased: false }, 'son');
  };

  return (
    <div className="space-y-4">
      {/* 이 탭의 피상속인 기본 정보 */}
      {!deceasedPerson.isRoot && (
        <div className="bg-[#fff8f0] dark:bg-orange-900/20 border border-[#fcd9a8] dark:border-orange-800/50 rounded-md p-4 text-[13px] text-[#92400e] dark:text-orange-200 leading-relaxed">
          <div className="font-bold mb-1">{deceasedPerson.name}의 상속인 정보입니다.</div>
          {sourcePersonName && (
             <div className="text-[12px] text-[#0284c7] dark:text-sky-400 mt-1">
               ※ {sourcePersonName}의 상속인을 자동으로 불러왔습니다. {deceasedPerson.name}의 상속인이 아닌 경우 삭제하시기 바랍니다.
             </div>
          )}
        </div>
      )}

      {/* 상속인 목록 */}
      <div className="space-y-2">
        {heirPersons.map((heir, idx) => {
          const isSpouse = heir.relRole === 'wife' || heir.relRole === 'husband';
          const isDeadBeforeAncestor = heir.isDeceased && heir.deathDate &&
            deceasedPerson.deathDate && heir.deathDate < deceasedPerson.deathDate;
          const isSpouseDeadBefore = isSpouse && isDeadBeforeAncestor;

          return (
            <div key={heir.id}
              className={`flex flex-wrap items-center gap-2 p-2.5 rounded-md border transition-colors nav-row
                ${isSpouseDeadBefore
                  ? 'bg-[#fee2e2] dark:bg-red-900/20 border-[#fecaca] dark:border-red-800/50'
                  : isSpouse
                    ? 'bg-[#eff6ff] dark:bg-blue-900/20 border-[#bfdbfe] dark:border-blue-800/50'
                    : 'bg-white dark:bg-neutral-800 border-[#d4d4d4] dark:border-neutral-700'
                }`}
            >
              {/* 성명 */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden">
                <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-2 py-1.5 text-[12px] border-r border-[#cccccc] dark:border-slate-600">성명</span>
                <input
                  type="text"
                  value={heir.name}
                  onKeyDown={onKeyDown}
                  onChange={e => onUpdatePerson(heir.id, 'name', e.target.value)}
                  onFocus={e => e.target.select()}
                  className="w-20 px-2 py-1.5 text-[14px] font-bold text-[#0b6e99] dark:text-blue-400 outline-none bg-transparent"
                />
              </div>

              {/* 관계 */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-[#cccccc] dark:border-slate-600 rounded overflow-hidden relative">
                <span className="bg-[#f1f1ef] dark:bg-slate-700 text-[#504f4c] dark:text-slate-300 font-semibold px-2 py-1.5 text-[12px] border-r border-[#cccccc] dark:border-slate-600">관계</span>
                <select
                  value={heir.relRole}
                  onKeyDown={onKeyDown}
                  onChange={e => onUpdateRelationship(deceasedPerson.id, heir.id, 'role', e.target.value)}
                  className="w-[90px] px-2 py-1.5 text-[13px] font-semibold text-[#37352f] dark:text-slate-200 bg-transparent outline-none cursor-pointer appearance-none"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="dark:bg-slate-800">
                      {lawEra === '1991' && (opt.value === 'son' || opt.value === 'daughter') ? '자녀' : opt.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[#787774] dark:text-slate-400">
                  <IconChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              {/* 사망 체크 */}
              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer transition-colors select-none text-[12px] font-bold
                ${heir.isDeceased
                  ? 'bg-[#ffe2dd] dark:bg-red-900/40 border-[#f0c0b9] dark:border-red-800/50 text-[#c93f3a] dark:text-red-400'
                  : 'bg-white dark:bg-slate-800 border-[#cccccc] dark:border-slate-600 text-[#787774] dark:text-slate-400 hover:bg-[#f1f1ef] dark:hover:bg-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={heir.isDeceased || false}
                  onKeyDown={onKeyDown}
                  onChange={e => onUpdatePerson(heir.id, 'isDeceased', e.target.checked)}
                  className="w-3.5 h-3.5 cursor-pointer accent-[#c93f3a]"
                />
                사망
              </label>

              {/* 사망일 */}
              {heir.isDeceased && (
                <div className="flex items-center bg-white dark:bg-slate-800 border border-[#f0c0b9] dark:border-red-800/50 rounded overflow-hidden">
                  <span className="bg-[#ffe2dd] dark:bg-red-900/40 text-[#c93f3a] dark:text-red-400 font-semibold px-2 py-1.5 text-[12px] border-r border-[#f0c0b9] dark:border-red-800/50">사망일</span>
                  <DateInput
                    value={heir.deathDate}
                    onKeyDown={onKeyDown}
                    onChange={v => onUpdatePerson(heir.id, 'deathDate', v)}
                    className="w-28 px-2 py-1.5 text-[13px] font-semibold outline-none text-[#37352f] dark:text-slate-200 bg-transparent"
                  />
                </div>
              )}

              {/* 배우자 먼저 사망 불가 안내 */}
              {isSpouseDeadBefore && (
                <span className="text-[11px] font-bold text-[#c93f3a] dark:text-red-400">
                  ⚠️ 피상속인 보다 먼저 사망하였으므로 상속권 없음
                </span>
              )}

              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={() => onRemoveHeir(deceasedPerson.id, heir.id)}
                onKeyDown={onKeyDown}
                className="text-[#d4d4d4] dark:text-slate-500 hover:text-[#c93f3a] dark:hover:text-red-400 p-1 ml-auto rounded transition-colors"
                title="삭제"
              >
                <IconTrash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 상속인 추가 버튼 영역 */}
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleAddNewHeir}
          className="flex items-center gap-1.5 text-[13px] font-bold text-[#504f4c] dark:text-neutral-400 border border-[#d4d4d4] dark:border-neutral-600 hover:bg-[#f1f1ef] dark:hover:bg-neutral-700 px-3 py-1.5 rounded transition-colors shadow-sm"
        >
          <IconUserPlus className="w-4 h-4" /> 새 상속인 추가
        </button>
      </div>
    </div>
  );
};

export default DeceasedTabPanel;
