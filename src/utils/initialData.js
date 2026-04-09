export const getInitialTree = () => {
  return getEmptyTree();
};


export const getEmptyTree = () => ({
  id: 'root', caseNo: '', name: '', 
  isDeceased: true, deathDate: '', shareN: 1, shareD: 1,
  isRenounced: false, isBiological: true, // 상속포기 및 친모여부 추가
  heirs: []
});
