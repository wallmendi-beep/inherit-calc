import { math } from './utils.js';

const flattenGroupShares = (groups = [], bucket = []) => {
  groups.forEach((group) => {
    (group.shares || []).forEach((share) => bucket.push(share));
    if (group.subGroups?.length) flattenGroupShares(group.subGroups, bucket);
  });
  return bucket;
};

const flattenFinalShares = (finalShares) => {
  const all = [];
  (finalShares?.direct || []).forEach((share) => all.push(share));
  flattenGroupShares(finalShares?.subGroups || [], all);
  return all;
};

const collectResolvedTransitIds = (groups = [], resolved = new Set()) => {
  groups.forEach((group) => {
    if (group?.ancestor?.personId) resolved.add(group.ancestor.personId);
    if (group.subGroups?.length) collectResolvedTransitIds(group.subGroups, resolved);
  });
  return resolved;
};

const pushIssue = (issues, issue) => {
  issues.push({
    displayTargets: ['guide'],
    blocking: false,
    severity: 'warning',
    ...issue,
  });
};

const normalizeWarning = (warning) => {
  if (!warning) return null;
  if (typeof warning === 'string') {
    return {
      code: 'engine-warning',
      severity: 'warning',
      blocking: false,
      id: null,
      personId: null,
      targetTabId: null,
      text: warning,
    };
  }

  return {
    code: warning.code || 'engine-warning',
    severity: warning.severity || 'warning',
    blocking: !!warning.blocking,
    id: warning.id || null,
    personId: warning.personId || null,
    targetTabId: warning.targetTabId || warning.personId || warning.id || null,
    text: warning.text || '',
  };
};

export const auditInheritanceResult = ({
  tree,
  finalShares,
  transitShares = [],
  warnings = [],
}) => {
  const allFinalShares = flattenFinalShares(finalShares);
  const resolvedTransitIds = collectResolvedTransitIds(finalShares?.subGroups || []);
  const normalizedWarnings = (warnings || []).map(normalizeWarning).filter(Boolean);
  let totalN = 0;
  let totalD = 1;

  allFinalShares.forEach((share) => {
    if (share.n > 0) {
      [totalN, totalD] = math.add(totalN, totalD, share.n, share.d);
    }
  });

  const [expectedN, expectedD] = math.simplify(
    Math.max(1, Number(tree?.shareN) || 1),
    Math.max(1, Number(tree?.shareD) || 1)
  );

  const hasDeceasedInFinalShares = allFinalShares.some((share) => share.isDeceased);
  const unresolvedTransitShares = (transitShares || []).filter(
    (share) => share.n > 0 && !resolvedTransitIds.has(share.personId)
  );
  const hasTotalMismatch = totalN !== expectedN || totalD !== expectedD;
  const hasWarnings = normalizedWarnings.length > 0;

  const issues = [];

  // [v3.0.13] 媛怨꾨룄 怨꾩링????젹) ?좏슚??寃??
  const auditRelationHierarchy = (node, path = []) => {
    if (!node || !node.heirs) return;
    const isDescendant = ['son', 'daughter'].includes(node.relation);
    
    node.heirs.forEach(h => {
      // ?먮?(鍮꾩냽)???섏쐞??遺紐?議댁냽)??諛⑷퀎媛 ?ㅻ뒗 寃껋? ?곗씠???낅젰 ?ㅻ쪟???뺣쪧??留ㅼ슦 ?믪쓬
      if (isDescendant && h.relation === 'parent') {
        pushIssue(issues, {
          code: 'hierarchy-violation',
          severity: 'error',
          blocking: false, // 李⑤떒源뚯????섏? ?딅릺 媛뺥븳 寃쎄퀬
          id: h.id,
          personId: h.personId,
          text: `[${h.name || '상속인'}]은(는) 부모 관계로 설정되어 있는데 [${node.name || '해당 인물'}]의 하위에 배치되어 있습니다. 가계도 관계를 다시 확인해 주세요.`,
          displayTargets: ['guide', 'input']
        });
      }
      auditRelationHierarchy(h, [...path, node.name]);
    });
  };
  auditRelationHierarchy(tree);

  if (hasDeceasedInFinalShares) {
    pushIssue(issues, {
      code: 'deceased-in-final-shares',
      severity: 'error',
      blocking: true,
      text: '?щ쭩??吏遺꾩씠 理쒖쥌 洹??寃곌낵???⑥븘 ?덉뒿?덈떎. ?ъ긽???먮뒗 ??듭긽???꾨떖???앷퉴吏 泥섎━?섏? ?딆븯?????덉뒿?덈떎.',
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  }

  unresolvedTransitShares.forEach((share) => {
    pushIssue(issues, {
      code: 'unresolved-transit-share',
      severity: 'error',
      blocking: true,
      id: share.id || share.personId,
      personId: share.personId,
      name: share.name || '?대쫫 誘몄긽',
      relation: share.relation || '',
      shareN: share.n,
      shareD: share.d,
      targetTabId: share.personId || share.id || null,
      text: `[${share.name || '?대쫫 誘몄긽'}]??吏遺?${share.d}遺꾩쓽 ${share.n}???ㅼ쓬 ?곸냽?몄뿉寃??꾩쭅 ?꾨떖?섏? ?딆븯?듬땲??`,
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  });

  if (unresolvedTransitShares.length > 0) {
    const names = unresolvedTransitShares.map((share) => share.name).filter(Boolean);
    pushIssue(issues, {
      code: 'unresolved-transit-shares-summary',
      severity: 'error',
      blocking: true,
      text: `?щ쭩?먯쓽 以묎컙 洹??吏遺꾩씠 ?⑥븘 ?덉뒿?덈떎: ${names.join(', ') || '?대쫫 誘몄긽'}`,
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  }

  if (hasTotalMismatch) {
    pushIssue(issues, {
      code: 'final-total-mismatch',
      severity: 'error',
      blocking: true,
      text: `理쒖쥌 洹??吏遺??⑷퀎媛 ${expectedD}遺꾩쓽 ${expectedN}???꾨땲??${totalD}遺꾩쓽 ${totalN}?낅땲??`,
      displayTargets: ['guide', 'calc', 'result', 'summary'],
    });
  }

  normalizedWarnings.forEach((warning) => {
    pushIssue(issues, {
      ...warning,
      displayTargets: ['guide', 'input'],
    });
  });

  if (hasWarnings) {
    pushIssue(issues, {
      code: 'engine-warnings-present',
      severity: 'warning',
      blocking: false,
      text: `怨꾩궛 ?붿쭊???뺤씤???꾩슂??寃쎄퀬 ${warnings.length}嫄댁쓣 媛먯??덉뒿?덈떎.`,
      displayTargets: ['guide', 'input'],
    });
  }

  const blockingIssues = issues.filter((issue) => issue.blocking);
  const repairHints = blockingIssues.map((issue) => {
    let hintText = issue.text;
    
    // [v4.1] 臾몄젣 肄붾뱶蹂?留욎땄???닿껐 ?뚰듃 ?쒓났 (?⑥닚 ?꾩긽 諛섎났 諛⑹?)
    switch (issue.code) {
      case 'final-total-mismatch':
        hintText = '?섏쐞 怨꾨낫 以?吏遺?諛곕텇???꾨씫??怨녹씠 ?덈뒗吏, ?뱀? ?곸냽?ш린/寃곌꺽?먯쓽 泥섎━媛 踰뺣졊??留욊쾶 ?꾧껐?섏뿀?붿? ?뺤씤??二쇱꽭??';
        break;
      case 'deceased-in-final-shares':
        hintText = '?щ쭩?먯쓽 吏遺꾩씠 理쒖쥌 寃곌낵???⑥븘 ?덉뒿?덈떎. ?대떦 ?щ쭩?먯쓽 ?섏쐞 ?곸냽???낅젰 ??쑝濡??대룞?섏뿬 吏遺??꾨떖??留덈Т由ы빐 二쇱꽭??';
        break;
      case 'unresolved-transit-share':
        hintText = `[${issue.name || '?대쫫 誘몄긽'}]???섏쐞 怨꾨낫瑜??앹꽦?섍굅???щ텇諛?泥섎━瑜??듯빐 ?붿뿬 吏遺?${issue.shareD}遺꾩쓽 ${issue.shareN}??諛곕텇??二쇱꽭??`;
        break;
      case 'hierarchy-violation':
        hintText = '?곸쐞/?섏쐞 怨꾨낫??遺紐??먯떇 愿怨??ㅼ젙??踰뺤쟻?쇰줈 ??뱁븳吏 ?뺤씤?섍퀬 ?몃Ъ???щ같移섑빐 二쇱꽭??';
        break;
      case 'inheritance-cycle':
        hintText = `[${issue.name || '해당 인물'}] 탭에서 본인이나 조상 계통이 다시 하위 상속인으로 연결된 부분이 있는지 확인해 주세요. 같은 사람이 상하위 단계에 중복 연결되면 지분 전이가 중단됩니다.`;
        break;
      default:
        hintText = issue.personId ? `[${issue.name || '?대쫫 誘몄긽'}]???낅젰 ?곹깭瑜??뺤씤??二쇱꽭??` : issue.text;
    }

    return {
      code: issue.code,
      personId: issue.personId || issue.id || null,
      name: issue.name || null,
      targetTabId: issue.targetTabId || issue.personId || issue.id || null,
      text: hintText,
    };
  });
  const entityIssues = issues.filter((issue) => issue.personId || issue.id);

  return {
    total: { n: totalN, d: totalD },
    expectedTotal: { n: expectedN, d: expectedD },
    hasDeceasedInFinalShares,
    unresolvedTransitShares,
    hasTotalMismatch,
    issues,
    entityIssues,
    blockingIssues,
    repairHints,
    hasBlockingIssues: blockingIssues.length > 0,
  };
};

