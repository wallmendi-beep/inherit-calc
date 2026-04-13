import { useMemo } from 'react';
import { getLawEra, isBefore } from '../engine/utils';
import { auditInheritanceResult } from '../engine/inheritanceAudit';

export const useSmartGuide = (tree, finalShares, activeTab, warnings = [], transitShares = [], importIssues = []) => {
  return useMemo(() => {
    if (!tree) {
      return {
        showGlobalWarning: false,
        showAutoCalcNotice: false,
        globalMismatchReasons: [],
        autoCalculatedNames: [],
        smartGuides: [],
        noSurvivors: false,
        hasActionItems: false,
        auditActionItems: [],
        repairHints: [],
      };
    }

    // [v4.32] 珥덇린 ?곹깭 (湲곗큹 ?뺣낫 ?꾨씫) 理쒖슦??媛?대뱶
    if (!tree.name?.trim() || !tree.deathDate) {
      return {
        showGlobalWarning: false,
        showAutoCalcNotice: false,
        globalMismatchReasons: [],
        autoCalculatedNames: [],
        smartGuides: [{
          id: 'initial-step',
          uniqueKey: 'initial-step',
          type: 'mandatory',
          text: "?ш굔踰덊샇? ?쇱긽?띿씤??湲곕낯?뺣낫瑜??낅젰?댁＜?몄슂.",
          targetTabId: 'root'
        }],
        noSurvivors: false,
        hasActionItems: true,
        auditActionItems: [],
        repairHints: ["?쇱긽?띿씤???깅챸怨??щ쭩?쇱옄瑜??낅젰?섏떆硫??뺢탳???곸냽??媛?대뱶媛 ?쒖옉?⑸땲??"],
      };
    }

    const audit = auditInheritanceResult({ tree, finalShares, transitShares, warnings });

    const uniqueGuidesMap = new Map();
    let noSurvivors = false;

    const findParentNodeInHook = (root, targetId) => {
      if (root.heirs && root.heirs.some(h => h.id === targetId)) return root;
      if (root.heirs) {
        for (const h of root.heirs) {
          const p = findParentNodeInHook(h, targetId);
          if (p) return p;
        }
      }
      return null;
    };

    const checkIndependentExclusionGuide = (node, level = 0) => {
      const isPredeceased = node.deathDate && tree.deathDate && isBefore(node.deathDate, tree.deathDate);
      
      if (node.id !== 'root' && node.isExcluded && ['renounce', 'disqualified'].includes(node.exclusionOption) && !isPredeceased) {
        const optionText = node.exclusionOption === 'renounce' ? '?곸냽?ш린' : '?곸냽寃곌꺽';
        uniqueGuidesMap.set(`indep-excl-${node.personId}`, {
          id: node.id, uniqueKey: `indep-excl-${node.personId}`, type: 'recommended',
          // ?슚 ?쒖옄由?遺硫붾옉 ?뚰봽 ?쒓굅: targetTabId ?띿꽦????젣?섏뿬 ?⑥닚 ?뚮┝????븷留??섑뻾
          text: `[${node.name}] ${optionText}媛 ?곸슜?섏뿀?듬땲?? ? ?쇱긽?띿씤 ??뿉?쒕룄 蹂꾨룄濡??쒖쇅 泥섎━??二쇱꽭??`,
          level, relation: node.relation
        });
      }
      if (node.heirs) node.heirs.forEach(h => checkIndependentExclusionGuide(h, level + 1));
    };

    const checkDuplicateSpouseGuide = (node, level = 0) => {
      const spouses = (node.heirs || []).filter((h) => {
        if (!['wife', 'husband', 'spouse'].includes(h.relation)) return false;
        if (h.isExcluded === true) return false;
        if (h.isDeceased && h.deathDate && node.deathDate && isBefore(h.deathDate, node.deathDate)) return false;
        return true;
      });

      if (spouses.length > 1) {
        const spouseNames = spouses.map((spouse) => spouse.name || '?대쫫?놁쓬');
        uniqueGuidesMap.set(`multi-spouse-${node.personId || node.id}`, {
          id: node.id,
          uniqueKey: `multi-spouse-${node.personId || node.id}`,
          targetTabId: node.personId || node.id || 'root',
          type: 'mandatory',
          level,
          text: `[${node.name || '?대쫫?놁쓬'}] 湲곗??쇰줈 ?좏슚 諛곗슦?먭? 以묐났 ?낅젰?섏뼱 ?덉뒿?덈떎. ?꾩옱 諛곗슦?? [${spouseNames.join('], [')}]. ?ㅼ젣 ?곸냽諛쏅뒗 1紐낆쓣 ?쒖쇅?섍퀬 ?섎㉧吏???쒖쇅 泥섎━??二쇱꽭??`,
        });
      }

      if (node.heirs) node.heirs.forEach((h) => checkDuplicateSpouseGuide(h, level + 1));
    };

    const checkGuideNode = (node, parentDate, level = 0) => {
      const parentNode = findParentNodeInHook(tree, node.id);
      const parentTabId = parentNode ? parentNode.personId : 'root';

      const effectiveDate = node.deathDate || tree.deathDate;

      // ?슚 ?댁븘?덈뒗 ?щ엺? 蹂몄씤???섏쐞 ??씠 ?앹꽦?섏? ?딆쑝誘濡??섏쐞 媛怨꾨룄 寃?щ? ?앸왂??
      if (node.isDeceased || node.id === 'root') {
          const activeHeirs = (node.heirs || []).filter(h => !h.isExcluded);
          if (node.id !== 'root' && node.isDeceased && node.deathDate && activeHeirs.length === 0) {
            const compareDate = parentDate || tree.deathDate;
            const isPredeceased = compareDate ? isBefore(node.deathDate, compareDate) : false;
            const isChild = ['son', 'daughter'].includes(node.relation);
            const isSpouse = ['wife', 'husband', 'spouse'].includes(node.relation);

            let guideText = `[${node.name || '이름 미상'}]의 하위상속인이 없습니다. 확인해 주세요.`;

            if (isPredeceased) {
              if (isChild) {
                guideText = `[${node.name}]은(는) 선사망 상속인인데 하위상속인이 없습니다. 대습상속인(배우자 또는 직계비속) 누락 여부를 확인해 주세요.`;
              } else if (isSpouse) {
                guideText = '';
              }
            } else {
              const contextName = parentNode?.name || tree.name || '현재 계보';
              if (isSpouse) {
                guideText = `[${node.name}]의 하위상속인이 없습니다. 확인해 주세요. 미입력 시 [${contextName}] 계보 기준으로 자동 분배됩니다.`;
              } else {
                guideText = `[${node.name}]의 하위상속인이 없습니다. 확인해 주세요. 미입력 시 차순위 상속인에게 자동 분배됩니다.`;
              }
            }

            if (guideText) {
              uniqueGuidesMap.set(`missing-successors-${node.personId}`, {
                id: node.id, uniqueKey: `missing-successors-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                text: guideText
              });
            }
          }
          if (node.id !== 'root' && node.isDeceased && !node.deathDate) {
              uniqueGuidesMap.set(`missing-death-date-${node.personId}`, {
                  id: node.id, uniqueKey: `missing-death-date-${node.personId}`, targetTabId: parentTabId, type: 'mandatory',
                  text: `[${node.name || '?대쫫 誘몄긽'}]? ?щ쭩?먮줈 ?쒖떆?섏뼱 ?덉쑝???щ쭩?쇱씠 ?놁뒿?덈떎.`
              });
          }
          // 1. 諛곗슦??以묐났 寃??
          const spouses = (node.heirs || []).filter((h) => {
              if (!['wife', 'husband', 'spouse'].includes(h.relation)) return false;
              if (h.isExcluded) return false;
              if (h.isDeceased && h.deathDate && node.deathDate && isBefore(h.deathDate, node.deathDate)) return false;
              return true;
          });
          if (spouses.length > 1) {
              uniqueGuidesMap.set(`multi-spouse-${node.personId}`, {
                  id: node.id, uniqueKey: `multi-spouse-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                  text: `[${node.name || '?대쫫?놁쓬'}] ?좏슚 諛곗슦?먭? 以묐났 ?낅젰?섏뿀?듬땲?? ?ㅼ젣 ?곸냽諛쏆쓣 1紐??몄뿉???쒖쇅 泥섎━??二쇱꽭??`
              });
          }

          // 2. 援щ쾿 ?몄＜ 吏??寃??
          const hasHoju = (node.heirs || []).some(h => h.isHoju && !h.isExcluded);
          const needsHoju = getLawEra(effectiveDate) !== '1991' && (node.id === 'root' || ['son', '?꾨뱾'].includes(node.relation));
          if (needsHoju && !hasHoju && node.heirs && node.heirs.length > 0) {
              uniqueGuidesMap.set(`missing-hoju-${node.personId}`, {
                  id: node.id, uniqueKey: `missing-hoju-${node.personId}`, targetTabId: node.personId, type: 'mandatory',
                  text: `[${node.name || '?대쫫?놁쓬'}] 援щ쾿(${effectiveDate} ?щ쭩) ?곸슜 ??곸엯?덈떎. ?섏쐞 ?곸냽??以??몄＜?곸냽?몄쓣 吏?뺥빐 二쇱꽭??`
              });
          }

          // 3. ?곗뇙 ?몄＜ ?밴퀎 ??(?λ궓/?μ넀)
          if (getLawEra(effectiveDate) !== '1991' && node.isHoju && node.isDeceased) {
              const hasHojuChild = node.heirs && node.heirs.some(h => h.isHoju);
              if (!hasHojuChild && node.heirs && node.heirs.length > 0) {
                  uniqueGuidesMap.set(`chained-hoju-${node.personId}`, {
                      id: node.id, uniqueKey: `chained-hoju-${node.personId}`, type: 'recommended',
                      targetTabId: node.personId,
                      text: `[????? ?λ궓/?μ넀 ?곗뇙 ?몄＜ ?밴퀎 ?? ???щ엺 紐⑤몢 [?몄＜?곸냽] 耳??곹깭 ?좎?瑜?沅뚯옣?⑸땲??`,
                      level, relation: node.relation
                  });
              }
          }

          // 4. [援щ쾿 ?곗씠??怨듬갚 諛⑹?] 1990???댁쟾 ?щ쭩嫄댁쓽 '???몃뜲 ?쇱씤 ?뺣낫媛 ?꾪? ?녿뒗 寃쎌슦 ?뺤씤 ?붿껌
          if (getLawEra(effectiveDate) !== '1991' && node.relation === 'daughter') {
              if (!node.marriageDate && node.isSameRegister !== false) {
                  uniqueGuidesMap.set(`verify-marriage-${node.personId}`, {
                      id: node.id, uniqueKey: `verify-marriage-${node.personId}`, type: 'recommended',
                      targetTabId: parentTabId,
                      text: `[${node.name || '?대쫫誘몄긽'}] 援щ쾿(1990???댁쟾) ?곸슜 ??곸엯?덈떎. 異쒓?(湲고샎) ?щ????곕씪 吏遺꾩씠 ?ш쾶 ?щ씪吏誘濡? 湲고샎??寃쎌슦 [?쇱씤?쇱옄]瑜??낅젰?섍굅??[?곸냽沅??ㅼ쐞移? ?놁쓽 [?숈씪媛??異쒓?)] ?ㅼ젙???뺤씤??二쇱꽭??`,
                      level, relation: node.relation
                  });
              }
          }
      }

      if (node.heirs) {
        const nextParentDate = (node.deathDate && parentDate && isBefore(parentDate, node.deathDate)) ? node.deathDate : parentDate;
        node.heirs.forEach(h => checkGuideNode(h, nextParentDate, level + 1));
      }
    };

    checkIndependentExclusionGuide(tree, 0);
    checkDuplicateSpouseGuide(tree, 0);
    if (tree.heirs) { tree.heirs.forEach(h => checkGuideNode(h, tree.deathDate, 0)); }

    if (!tree.heirs || tree.heirs.length === 0 || tree.heirs.every(h => h.isExcluded && (!h.heirs || h.heirs.length === 0))) {
      noSurvivors = true;
    }

    // [v3.1.4] 媛먯궗 ?붿쭊 ?댁뒋 ?듯빀 (entityIssues瑜?uniqueGuidesMap??蹂묓빀)
    (audit.entityIssues || []).forEach((issue) => {
      const personId = issue.personId || issue.id;
      const key = `audit-${issue.code}-${personId}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: issue.id || personId,
          uniqueKey: key,
          personId: personId,
          targetTabId: issue.targetTabId || personId || 'root',
          name: issue.name || null,
          type: issue.severity === 'error' ? 'mandatory' : 'recommended',
          text: issue.text,
          code: issue.code,
          displayTargets: issue.displayTargets || ['guide'],
        });
      }
    });

    (importIssues || []).forEach((issue) => {
      const personKey = issue.personId || issue.nodeId || 'root';
      const key = `import-${issue.code}-${personKey}`;
      if (!uniqueGuidesMap.has(key)) {
        uniqueGuidesMap.set(key, {
          id: issue.nodeId || personKey,
          uniqueKey: key,
          personId: issue.personId || '',
          targetTabId: issue.targetTabId || personKey,
          name: issue.personName || null,
          type: issue.severity === 'error' ? 'mandatory' : 'recommended',
          text: `${issue.message} 불러오기 직후 입력값을 확인하고 저장한 뒤 계속 진행해 주세요.`,
          code: `import-${issue.code}`,
          displayTargets: ['guide'],
        });
      }
    });

    const smartGuides = Array.from(uniqueGuidesMap.values());
    
    // UI ?명솚?깆쓣 ?꾪빐 ?꾪꽣留곷맂 由ъ뒪???앹꽦
    const mandatoryGuides = smartGuides.filter(g => g.type === 'mandatory');
    const recommendedGuides = smartGuides.filter(g => g.type === 'recommended');

    const globalMismatchReasons = audit.issues.map((issue) => ({
      id: issue.targetTabId || issue.personId || issue.id || 'root',
      text: issue.text,
    }));

    return {
      showGlobalWarning: audit.issues.length > 0, 
      showAutoCalcNotice: false, 
      globalMismatchReasons, 
      autoCalculatedNames: [],
      smartGuides, // ?꾩껜 由ъ뒪??(SmartGuidePanel?먯꽌 ?대? ?꾪꽣留곹븿)
      noSurvivors,
      hasActionItems: smartGuides.length > 0 || audit.issues.length > 0,
      auditActionItems: [], // smartGuides濡??듯빀?섏뿀?쇰?濡?鍮?諛곗뿴 由ы꽩
      repairHints: audit.repairHints || [],
    };
  }, [tree, finalShares, activeTab, warnings, transitShares, importIssues]);
};

