import React from 'react';
import { getLawEra } from '../engine/utils';

export default function MetaHeader({ tree }) {
  return (
    <div className="w-full mb-6 pb-3 border-b border-[#e9e9e7] dark:border-neutral-700 text-[13px] text-[#504f4c] dark:text-neutral-400 flex flex-wrap gap-8 no-print">
      <span>사건번호: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.caseNo || '미입력'}</span></span>
      <span>피상속인: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.name || '미입력'}</span></span>
      <span>사망일자: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{tree.deathDate || '미입력'}</span></span>
      <span>적용 법령: <span className="text-[#37352f] dark:text-neutral-200 font-medium">{getLawEra(tree.deathDate)}년 기준</span></span>
    </div>
  );
}
