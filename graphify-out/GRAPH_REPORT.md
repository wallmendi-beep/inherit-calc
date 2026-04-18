# Graph Report - C:\VS_CODE\상속지분 계산기  (2026-04-18)

## Corpus Check
- 91 files · ~702,828 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 383 nodes · 418 edges · 67 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]

## God Nodes (most connected - your core abstractions)
1. `isBefore()` - 15 edges
2. `getLawEra()` - 10 edges
3. `getRelStr()` - 9 edges
4. `cloneTree()` - 8 edges
5. `buildHojuBonusPersonMap()` - 7 edges
6. `auditInheritanceResult()` - 6 edges
7. `extractHojuBonusNotices()` - 6 edges
8. `updateTreeNodes()` - 6 edges
9. `findNodeById()` - 6 edges
10. `updateDeathInfo()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `isBefore()` --calls--> `preprocessTree()`  [INFERRED]
  src\engine\utils.js → src\utils\vault.js
- `getWarningState()` --calls--> `isBefore()`  [INFERRED]
  backups\old_app2.js → src\engine\utils.js
- `applyAutoExclusion()` --calls--> `isBefore()`  [INFERRED]
  backups\old_app2.js → src\engine\utils.js
- `getWarningState()` --calls--> `isBefore()`  [INFERRED]
  backups\old_app_v2.js → src\engine\utils.js
- `MiniTreeView()` --calls--> `getStatusStyle()`  [INFERRED]
  backups\old_app_v2.js → scratch\App_bc.jsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (26): cleanForExport(), prepareCalcTree(), renderShareRow(), sanitizeNode(), DeceasedTabPanel(), HeirRow(), InputPanel(), MetaHeader() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (14): findPersonId(), handleAutoFill(), if(), addHeir(), applyUpdate(), buildTreeFromVault(), findDuplicates(), findParentNode() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (5): findNode(), genId(), 'marriageDate'(), applyWizard(), removeHeir()

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (2): getStatusStyle(), MiniTreeView()

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (0): 

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (11): buildIssueMap(), CalcPanelFinal(), buildIssueMap(), CalcPanelV2(), buildHojuBonusPersonMap(), extractHojuBonusNotices(), buildIssueMap(), ResultPanelFixed() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (16): appendQuickHeirs(), applyNodeUpdates(), cloneTree(), createNodeId(), createPersonId(), findNodeById(), generateId(), normalizeDateField() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (10): printResult(), gcd(), simplify(), calculateInheritance(), auditInheritanceResult(), collectResolvedTransitIds(), flattenFinalShares(), flattenGroupShares() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (7): App(), getEmptyTree(), getInitialTree(), useSmartGuide(), buildTreeFromVault(), preprocessTree(), migrateToVault()

### Community 9 - "Community 9"
Cohesion: 0.2
Nodes (3): createEmptyGraph(), createPerson(), migrateTreeToGraph()

### Community 10 - "Community 10"
Cohesion: 0.24
Nodes (8): ingestAiJsonInput(), printCurrentTab(), sanitizeAiFacts(), sanitizeKorFilePart(), saveFactTreeToFile(), findRawIds(), serializeFactTree(), serializeFullTree()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (3): check_metadata(), run(), main()

### Community 14 - "Community 14"
Cohesion: 0.7
Nodes (4): buildIssueMap(), CalcPanel(), getInterpretationMemo(), getInterpretationMeta()

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): buildIssueMap(), CalcPanelFixed(), getInterpretationMeta()

### Community 17 - "Community 17"
Cohesion: 0.83
Nodes (3): buildIssueMap(), getInterpretationNote(), ResultPanel()

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (2): buildHojuBonusDiffs(), collectFinalShares()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (2): buildIssueMap(), SummaryPanel()

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (1): Core Logic Specs

## Knowledge Gaps
- **1 isolated node(s):** `Core Logic Specs`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 28`** (2 nodes): `f()`, `App_v2.x_backup.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `logShares()`, `check_yuryang.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `onBtnClick()`, `HeirRow_410.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `onBtnClick()`, `HeirRow_bc.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `AiImportModal()`, `AiImportModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `AmountPanel()`, `AmountPanel.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `DateInput()`, `DateInput.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `MainLayout()`, `MainLayout.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `ResetConfirmModal()`, `ResetConfirmModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `TopToolbar.jsx`, `TopToolbar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `TopToolbarDesktop.jsx`, `TopToolbarDesktop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `TopToolbarFixed.jsx`, `TopToolbarFixed()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `CapsuleTabs()`, `CapsuleTabs.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `ContextualDrawer()`, `ContextualDrawer.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `DocumentCard()`, `DocumentCard.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `main()`, `build.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `findByName()`, `inspect_kimmyeongnam.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `playwright.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `test_app.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `test_app2.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `test_app3.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `HeirRow_v2.x_backup.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `old_app.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `InputPanel_bbb.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `inheritance.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `aiPrompt.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `aiPromptUtf8.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `complexSample.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `example.spec.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `dump_step_by_name.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `graphify.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `inspect_kimmyeongnam_maternal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `inspect_kimmyeongnam_paternal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `Core Logic Specs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isBefore()` connect `Community 0` to `Community 8`, `Community 6`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `MiniTreeView()` connect `Community 1` to `Community 8`, `Community 3`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `updateDeathInfo()` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `isBefore()` (e.g. with `getWarningState()` and `applyAutoExclusion()`) actually correct?**
  _`isBefore()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `getLawEra()` (e.g. with `sanitizeNode()` and `DeceasedTabPanel()`) actually correct?**
  _`getLawEra()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `getRelStr()` (e.g. with `renderShareRow()` and `renderShareRow()`) actually correct?**
  _`getRelStr()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `buildHojuBonusPersonMap()` (e.g. with `CalcPanelFinal()` and `CalcPanelV2()`) actually correct?**
  _`buildHojuBonusPersonMap()` has 5 INFERRED edges - model-reasoned connections that need verification._