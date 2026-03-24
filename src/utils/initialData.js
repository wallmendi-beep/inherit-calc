import { complexSampleData } from './complexSample';

export const getInitialTree = () => {
  return complexSampleData;
};


export const getEmptyTree = () => ({
  id: 'root', caseNo: '', name: '', 
  isDeceased: true, deathDate: '', shareN: 1, shareD: 1,
  heirs: []
});
