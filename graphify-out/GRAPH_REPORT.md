# Graph Report - .  (2026-04-18)

## Corpus Check
- Large corpus: 253 files · ~698,912 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 382 nodes · 416 edges · 66 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.8)
- Token cost: 1,000 input · 500 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Data Persistence|Data Persistence]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 2|Module 2]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 4|Module 4]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 6|Module 6]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Inheritance Logic|Inheritance Logic]]
- [[_COMMUNITY_Module 9|Module 9]]
- [[_COMMUNITY_Module 10|Module 10]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 13|Module 13]]
- [[_COMMUNITY_Inheritance Logic|Inheritance Logic]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 16|Module 16]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 21|Module 21]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 26|Module 26]]
- [[_COMMUNITY_Module 27|Module 27]]
- [[_COMMUNITY_Module 28|Module 28]]
- [[_COMMUNITY_Module 29|Module 29]]
- [[_COMMUNITY_Module 30|Module 30]]
- [[_COMMUNITY_Module 31|Module 31]]
- [[_COMMUNITY_Module 32|Module 32]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Module 44|Module 44]]
- [[_COMMUNITY_Module 45|Module 45]]
- [[_COMMUNITY_Module 46|Module 46]]
- [[_COMMUNITY_Module 47|Module 47]]
- [[_COMMUNITY_Module 48|Module 48]]
- [[_COMMUNITY_Module 49|Module 49]]
- [[_COMMUNITY_Module 50|Module 50]]
- [[_COMMUNITY_Module 51|Module 51]]
- [[_COMMUNITY_Module 52|Module 52]]
- [[_COMMUNITY_Module 53|Module 53]]
- [[_COMMUNITY_Module 54|Module 54]]
- [[_COMMUNITY_Module 55|Module 55]]
- [[_COMMUNITY_Module 56|Module 56]]
- [[_COMMUNITY_Module 57|Module 57]]
- [[_COMMUNITY_Inheritance Logic|Inheritance Logic]]
- [[_COMMUNITY_Module 59|Module 59]]
- [[_COMMUNITY_Module 60|Module 60]]
- [[_COMMUNITY_Module 61|Module 61]]
- [[_COMMUNITY_Module 62|Module 62]]
- [[_COMMUNITY_Module 63|Module 63]]
- [[_COMMUNITY_Module 64|Module 64]]
- [[_COMMUNITY_Module 65|Module 65]]

## God Nodes (most connected - your core abstractions)
1. `isBefore()` - 14 edges
2. `getRelStr()` - 9 edges
3. `getLawEra()` - 9 edges
4. `cloneTree()` - 8 edges
5. `buildHojuBonusPersonMap()` - 7 edges
6. `auditInheritanceResult()` - 6 edges
7. `extractHojuBonusNotices()` - 6 edges
8. `updateTreeNodes()` - 6 edges
9. `findNodeById()` - 6 edges
10. `updateDeathInfo()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `preprocessTree()` --calls--> `isBefore()`  [INFERRED]
  src\utils\vault.js → src\engine\utils.js
- `Inheritance Engine` --implements--> `Core Logic Specs`  [INFERRED]
  src/engine/inheritance.js → !명세서/specs/CORE_LOGIC_SPECS.md
- `getWarningState()` --calls--> `isBefore()`  [INFERRED]
  backups\old_app2.js → src\engine\utils.js
- `applyAutoExclusion()` --calls--> `isBefore()`  [INFERRED]
  backups\old_app2.js → src\engine\utils.js
- `getWarningState()` --calls--> `isBefore()`  [INFERRED]
  backups\old_app_v2.js → src\engine\utils.js

## Communities

### Community 0 - "Data Persistence"
Cohesion: 0.06
Nodes (12): findPersonId(), handleAutoFill(), if(), addHeir(), applyUpdate(), findDuplicates(), findParentNode(), findPId() (+4 more)

### Community 1 - "UI Components"
Cohesion: 0.08
Nodes (23): cleanForExport(), prepareCalcTree(), renderShareRow(), DeceasedTabPanel(), HeirRow(), InputPanel(), MetaHeader(), applyAutoExclusion() (+15 more)

### Community 2 - "Module 2"
Cohesion: 0.08
Nodes (3): findNode(), 'marriageDate'(), removeHeir()

### Community 3 - "UI Components"
Cohesion: 0.08
Nodes (0): 

### Community 4 - "Module 4"
Cohesion: 0.08
Nodes (2): genId(), applyWizard()

### Community 5 - "UI Components"
Cohesion: 0.13
Nodes (11): buildIssueMap(), CalcPanelFinal(), buildIssueMap(), CalcPanelV2(), buildHojuBonusPersonMap(), extractHojuBonusNotices(), buildIssueMap(), ResultPanelFixed() (+3 more)

### Community 6 - "Module 6"
Cohesion: 0.2
Nodes (17): sanitizeNode(), appendQuickHeirs(), applyNodeUpdates(), cloneTree(), createNodeId(), createPersonId(), findNodeById(), generateId() (+9 more)

### Community 7 - "UI Components"
Cohesion: 0.11
Nodes (11): App(), getStatusStyle(), getEmptyTree(), getInitialTree(), MiniTreeView(), buildTreeFromVault(), MiniTreeView(), useSmartGuide() (+3 more)

### Community 8 - "Inheritance Logic"
Cohesion: 0.15
Nodes (10): printResult(), gcd(), simplify(), calculateInheritance(), auditInheritanceResult(), collectResolvedTransitIds(), flattenFinalShares(), flattenGroupShares() (+2 more)

### Community 9 - "Module 9"
Cohesion: 0.2
Nodes (3): createEmptyGraph(), createPerson(), migrateTreeToGraph()

### Community 10 - "Module 10"
Cohesion: 0.24
Nodes (8): ingestAiJsonInput(), printCurrentTab(), sanitizeAiFacts(), sanitizeKorFilePart(), saveFactTreeToFile(), findRawIds(), serializeFactTree(), serializeFullTree()

### Community 11 - "UI Components"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 12 - "UI Components"
Cohesion: 0.33
Nodes (0): 

### Community 13 - "Module 13"
Cohesion: 0.33
Nodes (3): check_metadata(), run(), main()

### Community 14 - "Inheritance Logic"
Cohesion: 0.33
Nodes (6): App.jsx (Main Controller), Core Logic Specs, Inheritance Engine, Smart Guide Logic, Tauri Backend, Vault Lifecycle

### Community 15 - "UI Components"
Cohesion: 0.7
Nodes (4): buildIssueMap(), CalcPanel(), getInterpretationMemo(), getInterpretationMeta()

### Community 16 - "Module 16"
Cohesion: 0.4
Nodes (0): 

### Community 17 - "UI Components"
Cohesion: 0.83
Nodes (3): buildIssueMap(), CalcPanelFixed(), getInterpretationMeta()

### Community 18 - "UI Components"
Cohesion: 0.83
Nodes (3): buildIssueMap(), getInterpretationNote(), ResultPanel()

### Community 19 - "UI Components"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "UI Components"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Module 21"
Cohesion: 0.67
Nodes (2): buildHojuBonusDiffs(), collectFinalShares()

### Community 22 - "UI Components"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "UI Components"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "UI Components"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "UI Components"
Cohesion: 1.0
Nodes (2): buildIssueMap(), SummaryPanel()

### Community 26 - "Module 26"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Module 27"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Module 28"
Cohesion: 0.67
Nodes (0): 

### Community 29 - "Module 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Module 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Module 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Module 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Module 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Module 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Module 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Module 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Module 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Module 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Module 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Module 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Module 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Module 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Module 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Module 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Module 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Module 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Inheritance Logic"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Module 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Module 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Module 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Module 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Module 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Module 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Module 65"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **4 isolated node(s):** `Vault Lifecycle`, `Smart Guide Logic`, `Core Logic Specs`, `Tauri Backend`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Module 29`** (2 nodes): `f()`, `App_v2.x_backup.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 30`** (2 nodes): `logShares()`, `check_yuryang.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 31`** (2 nodes): `onBtnClick()`, `HeirRow_410.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 32`** (2 nodes): `onBtnClick()`, `HeirRow_bc.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `AiImportModal()`, `AiImportModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `AmountPanel()`, `AmountPanel.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `DateInput()`, `DateInput.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `MainLayout()`, `MainLayout.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `ResetConfirmModal()`, `ResetConfirmModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `TopToolbar.jsx`, `TopToolbar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `TopToolbarDesktop.jsx`, `TopToolbarDesktop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `TopToolbarFixed.jsx`, `TopToolbarFixed()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `CapsuleTabs()`, `CapsuleTabs.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `ContextualDrawer()`, `ContextualDrawer.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `DocumentCard()`, `DocumentCard.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 44`** (2 nodes): `main()`, `build.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 45`** (2 nodes): `findByName()`, `inspect_kimmyeongnam.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 46`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 47`** (1 nodes): `playwright.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 48`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 49`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 50`** (1 nodes): `test_app.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 51`** (1 nodes): `test_app2.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 52`** (1 nodes): `test_app3.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 53`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 54`** (1 nodes): `HeirRow_v2.x_backup.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 55`** (1 nodes): `old_app.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 56`** (1 nodes): `InputPanel_bbb.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 57`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Inheritance Logic`** (1 nodes): `inheritance.test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 59`** (1 nodes): `aiPrompt.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 60`** (1 nodes): `aiPromptUtf8.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 61`** (1 nodes): `complexSample.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 62`** (1 nodes): `example.spec.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 63`** (1 nodes): `dump_step_by_name.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 64`** (1 nodes): `inspect_kimmyeongnam_maternal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 65`** (1 nodes): `inspect_kimmyeongnam_paternal.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isBefore()` connect `UI Components` to `Module 6`, `UI Components`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `MiniTreeView()` connect `UI Components` to `Data Persistence`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `updateDeathInfo()` connect `Module 6` to `UI Components`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `isBefore()` (e.g. with `getWarningState()` and `applyAutoExclusion()`) actually correct?**
  _`isBefore()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `getRelStr()` (e.g. with `renderShareRow()` and `renderShareRow()`) actually correct?**
  _`getRelStr()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `getLawEra()` (e.g. with `sanitizeNode()` and `DeceasedTabPanel()`) actually correct?**
  _`getLawEra()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `buildHojuBonusPersonMap()` (e.g. with `CalcPanelFinal()` and `CalcPanelV2()`) actually correct?**
  _`buildHojuBonusPersonMap()` has 5 INFERRED edges - model-reasoned connections that need verification._