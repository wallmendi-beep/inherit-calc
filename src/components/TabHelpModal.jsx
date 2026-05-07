import React from 'react';
import { IconX } from './Icons';

const TOPIC_BY_TAB = {
  input: 'input',
  tree: 'tree',
  summary: 'summary',
};

const HELP_TOPICS = {
  input: {
    label: '데이터 입력',
    title: '데이터 입력 탭 사용법',
    summary: '상속지분 계산의 원천이 되는 가족관계와 사건 사실을 입력하고 수정하는 곳입니다.',
    sections: [
      {
        title: '무엇을 확인하나요',
        body: [
          '데이터 입력 탭에서는 계산 결과가 아니라 계산에 사용할 사실관계를 정리합니다.',
          '피상속인의 사건번호, 성명, 사망일자, 최초 분배 지분을 먼저 확인하고, 각 상속인의 관계와 날짜 정보를 정리합니다.',
        ],
        bullets: [
          '성명, 관계, 생존 또는 사망 여부',
          '사망일자, 혼인일, 재혼일, 이혼일, 복적일',
          '성별, 호주 여부, 동일가적 또는 비동일가적',
          '상속권 없음 또는 제외 사유',
        ],
      },
      {
        title: '후속 상속인 확인',
        body: [
          '사망한 상속인이 있으면 그 사람의 하위 상속인을 확인해야 합니다. 하위 상속인이 비어 있는 상태가 실제로 없음인지, 아직 입력하지 않은 것인지는 앱이 자동 확정하지 않습니다.',
          '필요한 상속인이 있으면 추가하고, 더 입력할 사람이 없으면 상황에 맞는 없음 확정 버튼을 사용합니다.',
        ],
      },
      {
        title: 'AI 자동입력 방법과 주의사항',
        body: [
          'AI 자동입력은 계산기가 직접 사진이나 PDF를 분석하는 기능이 아닙니다.',
          '계산기에서 제공하는 전용 프롬프트를 복사한 뒤, 사용자가 사용하는 외부 AI 도구에 자료와 함께 넣어 JSON을 만들고, 그 JSON을 다시 계산기에 붙여넣는 방식입니다.',
        ],
        steps: [
          '데이터 입력 탭에서 AI 자동입력 버튼을 누릅니다.',
          '계산기가 제공하는 전용 프롬프트를 클립보드에 복사합니다.',
          '사진, PDF, 판결문, 가족관계 설명, 메모 등 분석할 자료를 외부 AI 도구에 넣습니다.',
          '복사한 전용 프롬프트를 같은 대화에 함께 입력합니다.',
          '외부 AI가 만든 JSON 전체를 복사합니다.',
          '계산기의 AI 자동입력 창에 JSON을 붙여넣고 불러옵니다.',
          '입력된 상속인 구조, 관계, 날짜, 제외 사유를 사용자가 직접 검토하고 수정합니다.',
        ],
        bullets: [
          'AI가 만든 JSON은 입력 초안일 뿐이므로 계산 결과로 확정하지 않습니다.',
          '이름, 배우자·자녀·부모·형제자매 관계, 사망일자를 확인합니다.',
          '혼인일, 이혼일, 재혼일, 복적일이 필요한 사건인지 확인합니다.',
          '1991년 이전 구법 사건에서는 호주상속인, 동일가적·비동일가적, 출가 관련 정보를 직접 검토합니다.',
          '사망자 아래 하위 상속인이 누락되지 않았는지 확인합니다.',
          '부모나 형제자매가 자녀 아래에 들어가는 구조 오류가 없는지 확인합니다.',
          '후혼 배우자나 후혼 자녀가 특정 사건 상속인 범위에 잘못 섞이지 않았는지 확인합니다.',
          '외부 AI에 자료를 넣기 전 주민등록번호, 주소, 연락처 같은 불필요한 개인정보는 제거하는 것이 좋습니다.',
        ],
        note: '사용자가 직접 수정한 값이 AI가 만든 값보다 우선합니다. AI 입력 후에는 스마트 가이드와 사건 검토 탭에서 반드시 검수합니다.',
      },
    ],
    checklist: [
      '피상속인의 성명과 사망일자가 입력되어 있는가',
      '각 상속인의 관계가 맞는가',
      '사망한 사람의 사망일자가 입력되어 있는가',
      '사망한 사람 아래에 필요한 후속 상속인이 입력되어 있는가',
      'AI 또는 파일 불러오기 후 누락·중복·관계 오류를 확인했는가',
    ],
  },
  tree: {
    label: '사건 검토',
    title: '사건 검토 탭 사용법',
    summary: '피상속인별 사망 사건마다 상속지분이 어떻게 분배되고 이어지는지 검토하는 곳입니다.',
    sections: [
      {
        title: '화면 구성',
        body: [
          '좌측 사건 보고서는 현재 선택한 노드가 속한 하나의 상속사건을 설명합니다.',
          '우측 상속 흐름표는 사건별 분배 결과를 상속인, 관계, 취득지분, 흐름, 판정 요소로 보여줍니다.',
        ],
      },
      {
        title: '사건번호와 흐름 번호',
        body: [
          '`제N사건`은 실제 사망 사건의 번호입니다. 한 피상속인이 사망하여 그 사람의 지분을 다시 나누는 계산 단계가 하나의 사건입니다.',
          '`흐름 M`은 새 사건이 아닙니다. 같은 사망 사건으로 들어온 지분 원천이 여러 개인 경우 화면에서 이해하기 쉽게 나눈 하위 흐름입니다.',
        ],
        example: [
          '제3사건 · 흐름 1  홍길동 → 김철수 · 1/15',
          '제3사건 · 흐름 2  김영희 → 김철수 · 2/165',
        ],
      },
      {
        title: '흐름과 판정 요소',
        body: [
          '흐름 칸은 최종 취득, 재상속, 대습상속, 상속권 없음처럼 지분 이동 상태를 표시합니다.',
          '판정 요소 칸은 배우자 가산, 호주상속 가산, 구법 감산, 상속권 없음 사유처럼 지분이 달라진 이유를 짧게 보여줍니다.',
        ],
      },
    ],
    checklist: [
      '각 사건의 피상속인과 사망일이 맞는가',
      '상속인 관계가 사건 기준일에 맞는가',
      '상속권 없음 사유가 납득되는가',
      '선사망자는 대습상속 또는 제외로 처리되었는가',
      '후사망자는 재상속 사건으로 이어지는가',
    ],
  },
  summary: {
    label: '상속지분',
    title: '상속지분 탭 사용법',
    summary: '사건별로 흩어진 취득 지분을 최종 상속인별로 모아 검산하는 곳입니다.',
    sections: [
      {
        title: '취득합산',
        body: [
          '취득합산은 사건 검토 탭에서 계산된 여러 사건의 분배 결과를 최종 상속인별로 더해 보여줍니다.',
          '경로합산 칸에는 사람 이름 경로를 쓰지 않고 숫자 합산식만 표시합니다.',
        ],
        example: ['① 1/15 + ② 2/165'],
      },
      {
        title: '취득계보',
        body: [
          '좌측 취득계보 패널은 선택한 상속인의 지분이 누구를 거쳐 내려왔는지를 보여줍니다.',
          '표의 ①, ② 번호는 좌측 패널의 ① 경로, ② 경로와 대응합니다.',
        ],
      },
      {
        title: '최종지분표',
        body: [
          '최종지분표는 최종 생존 상속인별 지분을 정리해서 보여줍니다.',
          '그룹통분 지분은 같은 가족 그룹 안에서 비교하기 위한 값이고, 전체통분 지분은 모든 최종 상속인의 지분을 한 분모로 맞춘 값입니다.',
        ],
      },
    ],
    checklist: [
      '최종 상속인별 지분이 한 사람당 한 줄로 수렴되는가',
      '복수 경로 번호가 좌측 취득계보와 대응하는가',
      '경로합산의 덧셈 결과가 최종지분과 일치하는가',
      '그룹통분 지분이 같은 가족 그룹 안에서 같은 분모로 표시되는가',
      '전체통분 지분의 합계가 전체 지분과 맞는가',
    ],
  },
  logic: {
    label: '판정 로직',
    title: '판정 로직 이해하기',
    summary: '앱은 각 사망 사건의 기준일, 관계, 생사 상태, 가적·호주 정보, 제외 사유를 기준으로 상속권과 지분을 판정합니다.',
    sections: [
      {
        title: '사건별 판정',
        body: [
          '상속지분 계산은 전체 가계도를 한 번에 단순 분배하는 방식이 아닙니다.',
          '앱은 피상속인이 사망한 사건을 하나씩 만들고, 그 사건의 기준일에서 상속인을 다시 판단합니다.',
        ],
      },
      {
        title: '적용 법 시기',
        body: [
          '사망일을 기준으로 1960년 제정 민법 시기, 1979년 개정 민법 시기, 1991년 이후 현행 민법 시기를 구분합니다.',
          '법 시기에 따라 배우자 지분, 여성 상속인의 감산 여부, 호주상속 가산 여부가 달라질 수 있습니다.',
        ],
      },
      {
        title: '선사망과 후사망',
        body: [
          '선사망자는 현재 사건에서 직접 최종 취득자가 되지 않습니다. 유효한 대습상속인이 있으면 대습상속 흐름이 열릴 수 있습니다.',
          '후사망자는 현재 사건에서 일단 자기 지분을 취득한 뒤, 그 사람이 다시 사망한 사건에서 재상속됩니다.',
        ],
      },
      {
        title: '판정 요소 예시',
        bullets: [
          '균분',
          '배우자 5할 가산',
          '비동일가적, 감산(남자의 1/4)',
          '동일가적 여자, 감산(남자의 1/2)',
          '호주상속 5할 가산',
          '1991년 이전 처 사망(대습상속 불가)',
        ],
      },
    ],
    checklist: [
      '사망일 기준 적용 법 시기가 맞는가',
      '선사망자와 후사망자가 현재 사건 기준일에 맞게 구분되는가',
      '구법 사건의 동일가적·비동일가적 입력이 맞는가',
      '호주상속 가산 대상자가 맞게 지정되었는가',
      '제외 사유가 판정 요소에 맞게 표시되는가',
    ],
  },
};

const topicOrder = ['input', 'tree', 'summary', 'logic'];

const Section = ({ section }) => (
  <section className="space-y-2 rounded-lg border border-[#e9e9e7] bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
    <h3 className="text-[13px] font-bold text-[#37352f] dark:text-neutral-100">{section.title}</h3>
    {(section.body || []).map((text, index) => (
      <p key={`${section.title}-body-${index}`} className="text-[12.5px] leading-relaxed text-[#5d5b57] dark:text-neutral-300">{text}</p>
    ))}
    {section.bullets && (
      <ul className="space-y-1 text-[12.5px] leading-relaxed text-[#5d5b57] dark:text-neutral-300">
        {section.bullets.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    )}
    {section.steps && (
      <ol className="list-decimal space-y-1 pl-4 text-[12.5px] leading-relaxed text-[#5d5b57] dark:text-neutral-300">
        {section.steps.map((item) => <li key={item}>{item}</li>)}
      </ol>
    )}
    {section.example && (
      <div className="rounded-md bg-[#f7f7f5] px-3 py-2 font-mono text-[12px] leading-relaxed text-[#504f4c] dark:bg-neutral-800 dark:text-neutral-300">
        {section.example.map((line) => <div key={line}>{line}</div>)}
      </div>
    )}
    {section.note && (
      <p className="rounded-md bg-[#f0f6ff] px-3 py-2 text-[12px] font-medium text-[#3b5f8a] dark:bg-blue-950/30 dark:text-blue-300">{section.note}</p>
    )}
  </section>
);

export const getHelpTopicForTab = (tabId) => TOPIC_BY_TAB[tabId] || 'input';

export default function TabHelpModal({ isOpen, onClose, activeTopic, onTopicChange }) {
  const topic = HELP_TOPICS[activeTopic] || HELP_TOPICS.input;

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-8 py-8 print:hidden"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tab-help-title"
        className="flex max-h-[82vh] w-[860px] flex-col overflow-hidden rounded-xl border border-[#dcdcd9] bg-white shadow-2xl dark:border-neutral-600 dark:bg-neutral-900"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e9e9e7] px-5 py-4 dark:border-neutral-700">
          <div>
            <div className="text-[12px] font-bold text-[#787774] dark:text-neutral-400">도움말</div>
            <h2 id="tab-help-title" className="mt-0.5 text-[18px] font-black text-[#37352f] dark:text-neutral-100">{topic.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="도움말 닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#787774] transition-colors hover:bg-[#f1f1ef] hover:text-[#37352f] dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-[#e9e9e7] px-5 py-3 dark:border-neutral-700">
          <div className="flex gap-1.5">
            {topicOrder.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onTopicChange(id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  activeTopic === id
                    ? 'bg-[#37352f] text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-[#f1f1ef] text-[#787774] hover:bg-[#e9e9e7] dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                {HELP_TOPICS[id].label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-[13px] leading-relaxed text-[#787774] dark:text-neutral-300">{topic.summary}</p>

          <div className="space-y-3">
            {topic.sections.map((section) => <Section key={section.title} section={section} />)}
          </div>

          {topic.checklist && (
            <section className="mt-3 rounded-lg border border-[#d7e5f9] bg-[#f7fbff] p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
              <h3 className="text-[13px] font-bold text-[#3b5f8a] dark:text-blue-300">확인 체크리스트</h3>
              <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-[#4f6075] dark:text-blue-100">
                {topic.checklist.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
