import { useMemo } from 'react';
import { math } from '../engine/utils';

export function useAmountCalc(finalShares, propertyValue, specialBenefits, contributions) {
  return useMemo(() => {
    const list = [];
    if (finalShares?.direct) list.push(...finalShares.direct);
    if (finalShares?.subGroups) {
      const scan = (group) => {
        list.push(...group.shares);
        if (group.subGroups) group.subGroups.forEach(scan);
      };
      finalShares.subGroups.forEach(scan);
    }

    const estateVal = parseInt(String(propertyValue).replace(/[^0-9]/g, ''), 10) || 0;
    let totalSpecial = 0;
    let totalContrib = 0;
    list.forEach((share) => {
      totalSpecial += parseInt(String(specialBenefits[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0;
      totalContrib += parseInt(String(contributions[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0;
    });

    const deemedEstate = estateVal + totalSpecial - totalContrib;
    const results = list.map((share) => {
      const sVal = parseInt(String(specialBenefits[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0;
      const cVal = parseInt(String(contributions[share.personId] || '').replace(/[^0-9]/g, ''), 10) || 0;
      const statutoryAmount = Math.floor(deemedEstate * (share.n / share.d));
      const finalAmount = Math.max(0, statutoryAmount - sVal) + cVal;
      return { ...share, statutoryAmount, specialBenefit: sVal, contribution: cVal, finalAmount };
    });

    const totalDistributed = results.reduce((acc, r) => acc + (r.finalAmount || 0), 0);
    const remainder = Math.max(0, estateVal - totalDistributed);
    return { estateVal, deemedEstate, results, totalDistributed, remainder };
  }, [finalShares, propertyValue, specialBenefits, contributions]);
}
