(function () {
  const savedLoginKey = "larkixmaker_admin_saved_login";
  const draftKey = "larkixmaker_admin_autodraft_v1";
  const sidebarStateKey = "larkixmaker_admin_sidebar_collapsed";
  const editorDockStateKey = "larkixmaker_admin_editor_dock_collapsed";
  const articlePublishDockStateKey = "larkixmaker_admin_article_publish_dock_collapsed";
  const autosaveDelay = 900;
  const operationTimeoutMs = 20_000;
  const adminPathMarker = "/admin/";
  const adminPathIndex = window.location.pathname.indexOf(adminPathMarker);
  const privateCmsBase = adminPathIndex > 0 ? window.location.pathname.slice(0, adminPathIndex) : "";

  function privateApiPath(path) {
    return privateCmsBase && String(path || "").startsWith("/api/") ? `${privateCmsBase}${path}` : path;
  }

  const loginPanel = document.querySelector("#loginPanel");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#loginForm");
  const loginNotice = document.querySelector("#loginNotice");
  const passwordToggle = document.querySelector("#passwordToggle");
  const sidebarToggle = document.querySelector("#sidebarToggle");
  const editorDock = document.querySelector("#editor");
  const editorDockToggle = document.querySelector("#editorDockToggle");
  const editorDockHandle = document.querySelector("#editorDockHandle");
  const editorDockState = document.querySelector("#editorDockState");
  const adminNotice = document.querySelector("#adminNotice");
  const nonArticleSaveButton = document.querySelector("#nonArticleSaveButton");
  const articlePublishDock = document.querySelector("#articlePublishDock");
  const articlePublishDockBody = document.querySelector("#articlePublishDockBody");
  const articlePublishDockStatus = document.querySelector("#articlePublishDockStatus");
  const articlePublishDockCollapse = document.querySelector("#articlePublishDockCollapse");
  const articlePublishDockExpand = document.querySelector("#articlePublishDockExpand");
  const articleSaveDraftButton = document.querySelector("#articleSaveDraftButton");
  const articlePublishButton = document.querySelector("#articlePublishButton");
  const cmsToastRegion = document.querySelector("#cmsToastRegion");
  const focusModeGate = document.querySelector("#focusModeGate");
  const focusModeToggle = document.querySelector("#focusModeToggle");
  const focusModeGateState = document.querySelector("#focusModeGateState");
  const focusModeGateWarning = document.querySelector("#focusModeGateWarning");
  const saveFocusModeButton = document.querySelector("#saveFocusModeButton");
  const logoutButton = document.querySelector("#logoutButton");
  const exportButton = document.querySelector("#exportButton");
  const contentForm = document.querySelector("#contentForm");
  const preview = document.querySelector("#markdownPreview");
  const markdownFile = document.querySelector("#markdownFile");
  const markdownHint = document.querySelector("#markdownHint");
  const articleFormulaHelperPanel = document.querySelector("#articleFormulaHelperPanel");
  const openFormulaAuthoringButton = document.querySelector("#openFormulaAuthoringButton");
  const formulaHelperPanel = document.querySelector("#formulaHelperPanel");
  const formulaSnippetSelect = document.querySelector("#formulaSnippetSelect");
  const insertInlineFormulaButton = document.querySelector("#insertInlineFormulaButton");
  const insertDisplayFormulaButton = document.querySelector("#insertDisplayFormulaButton");
  const insertFormulaSnippetButton = document.querySelector("#insertFormulaSnippetButton");
  const deriveLinkSlugInput = document.querySelector("#deriveLinkSlugInput");
  const deriveLinkLabelInput = document.querySelector("#deriveLinkLabelInput");
  const deriveLinkColorSelect = document.querySelector("#deriveLinkColorSelect");
  const insertDeriveLinkButton = document.querySelector("#insertDeriveLinkButton");
  const boostTemplateSelect = document.querySelector("#boostTemplateSelect");
  const applyBoostTemplateButton = document.querySelector("#applyBoostTemplateButton");
  const insertBoostChainButton = document.querySelector("#insertBoostChainButton");
  const coverFile = document.querySelector("#coverFile");
  const coverPreview = document.querySelector("#coverPreview");
  const coverPreviewShell = document.querySelector("#coverPreviewShell");
  const coverHint = document.querySelector("#coverHint");
  const coverCoordinateActions = document.querySelector("#coverCoordinateActions");
  const coverCropEdit = document.querySelector("#coverCropEdit");
  const coverCropReset = document.querySelector("#coverCropReset");
  const coverCropModal = document.querySelector("#coverCropModal");
  const coverCropStage = document.querySelector("#coverCropStage");
  const coverCropSurface = document.querySelector("#coverCropSurface");
  const coverCropMutedImage = document.querySelector("#coverCropMutedImage");
  const coverCropClearImage = document.querySelector("#coverCropClearImage");
  const coverCropSelection = document.querySelector("#coverCropSelection");
  const coverCropStatus = document.querySelector("#coverCropStatus");
  const coverCropApply = document.querySelector("#coverCropApply");
  const coverCropCancel = document.querySelector("#coverCropCancel");
  const resetButton = document.querySelector("#resetButton");
  const list = document.querySelector("#adminContentList");
  const categoryField = document.querySelector("#categoryField");
  const recommendationPriorityField = document.querySelector("#recommendationPriorityField");
  const readingMinutesField = document.querySelector("#readingMinutesField");
  const statusField = document.querySelector("#statusField");
  const knowledgeSlugField = document.querySelector("#knowledgeSlugField");
  const knowledgeSymbolField = document.querySelector("#knowledgeSymbolField");
  const knowledgeAccentField = document.querySelector("#knowledgeAccentField");
  const knowledgeVisibilityField = document.querySelector("#knowledgeVisibilityField");
  const knowledgeWarnings = document.querySelector("#knowledgeWarnings");
  const knowledgeRevisionsPanel = document.querySelector("#knowledgeRevisionsPanel");
  const knowledgeRevisionList = document.querySelector("#knowledgeRevisionList");
  const refreshKnowledgeRevisionsButton = document.querySelector("#refreshKnowledgeRevisionsButton");
  const projectExtra = document.querySelector("#projectExtra");
  const visibilityHint = document.querySelector("#visibilityHint");
  const featuredField = document.querySelector(".meta-featured");
  const imageLibrary = document.querySelector("#imageLibrary");
  const refreshImagesButton = document.querySelector("#refreshImagesButton");
  const draftStatus = document.querySelector("#draftStatus");
  const draftStatusText = document.querySelector("#draftStatusText");
  const discardDraftButton = document.querySelector("#discardDraftButton");
  const contentSearch = document.querySelector("#contentSearch");
  const typeFilter = document.querySelector("#typeFilter");
  const statusFilter = document.querySelector("#statusFilter");
  const clearFiltersButton = document.querySelector("#clearFiltersButton");
  const selectAllContent = document.querySelector("#selectAllContent");
  const contentResultCount = document.querySelector("#contentResultCount");
  const selectedCount = document.querySelector("#selectedCount");
  const recentContentList = document.querySelector("#recentContentList");
  const featuredSlots = document.querySelector("#featuredSlots");
  const carouselManagerSummary = document.querySelector("#carouselManagerSummary");
  const carouselConflictReport = document.querySelector("#carouselConflictReport");
  const carouselBufferList = document.querySelector("#carouselBufferList");
  const adminViews = [...document.querySelectorAll("[data-admin-view]")];
  const adminNavLinks = [...document.querySelectorAll("[data-admin-nav]")];
  const bulkPublishButton = document.querySelector("#bulkPublishButton");
  const bulkDraftButton = document.querySelector("#bulkDraftButton");
  const bulkDeleteButton = document.querySelector("#bulkDeleteButton");
  const bulkRestoreButton = document.querySelector("#bulkRestoreButton");
  const refreshHealthButton = document.querySelector("#refreshHealthButton");
  const healthPanel = document.querySelector("#healthPanel");
  const layoutPanel = document.querySelector("#layoutPanel");
  const knowledgeNodeList = document.querySelector("#knowledgeNodeList");
  const newKnowledgeNodeButton = document.querySelector("#newKnowledgeNodeButton");
  const formulaCategoryTree = document.querySelector("#formulaCategoryTree");
  const formulaCatalogSummary = document.querySelector("#formulaCatalogSummary");
  const formulaCardList = document.querySelector("#formulaCardList");
  const formulaRepairSummary = document.querySelector("#formulaRepairSummary");
  const formulaRepairStatus = document.querySelector("#formulaRepairStatus");
  const formulaRepairIssue = document.querySelector("#formulaRepairIssue");
  const formulaRepairRefresh = document.querySelector("#formulaRepairRefresh");
  const formulaRepairList = document.querySelector("#formulaRepairList");
  const formulaSearchInput = document.querySelector("#formulaSearchInput");
  const formulaTagFilter = document.querySelector("#formulaTagFilter");
  const formulaArchiveFilter = document.querySelector("#formulaArchiveFilter");
  const formulaImportFile = document.querySelector("#formulaImportFile");
  const formulaImportButton = document.querySelector("#formulaImportButton");
  const formulaExportButton = document.querySelector("#formulaExportButton");
  const newFormulaButton = document.querySelector("#newFormulaButton");
  const formulaPreviousPage = document.querySelector("#formulaPreviousPage");
  const formulaNextPage = document.querySelector("#formulaNextPage");
  const formulaPageStatus = document.querySelector("#formulaPageStatus");
  const formulaCardEditor = document.querySelector("#formulaCardEditor");
  const formulaEditorTitle = document.querySelector("#formulaEditorTitle");
  const formulaEditorCancel = document.querySelector("#formulaEditorCancel");
  const formulaEditorPreview = document.querySelector("#formulaEditorPreview");
  const formulaMarkdownPreview = document.querySelector("#formulaMarkdownPreview");
  const formulaEditorStatus = document.querySelector("#formulaEditorStatus");
  const formulaPublicationHint = document.querySelector("#formulaPublicationHint");
  const formulaPublishButton = document.querySelector("#formulaPublishButton");
  const formulaVisitorPreview = document.querySelector("#formulaVisitorPreview");
  const formulaTechnicalInfo = document.querySelector("#formulaTechnicalInfo");
  const formulaTechnicalId = document.querySelector("#formulaTechnicalId");
  const formulaTechnicalSlug = document.querySelector("#formulaTechnicalSlug");
  const formulaCopyStatus = document.querySelector("#formulaCopyStatus");
  const formulaClassificationKind = document.querySelector("#formulaClassificationKind");
  const formulaClassificationParentField = document.querySelector("#formulaClassificationParentField");
  const formulaClassificationParent = document.querySelector("#formulaClassificationParent");
  const formulaClassificationName = document.querySelector("#formulaClassificationName");
  const formulaClassificationCreate = document.querySelector("#formulaClassificationCreate");
  const formulaClassificationList = document.querySelector("#formulaClassificationList");
  const formulaModuleOptions = document.querySelector("#formulaModuleOptions");
  const formulaCategoryOptions = document.querySelector("#formulaCategoryOptions");
  const formulaTagOptions = document.querySelector("#formulaTagOptions");
  const formulaTagPicker = document.querySelector("#formulaTagPicker");
  const formulaTagAddButton = document.querySelector("#formulaTagAddButton");
  const formulaSelectedTags = document.querySelector("#formulaSelectedTags");
  const formulaFieldHelpPopover = document.querySelector("#formulaFieldHelpPopover");
  const formulaRevisionList = document.querySelector("#formulaRevisionList");
  const formulaDerivationPanel = document.querySelector("#formulaDerivationPanel");
  const formulaDerivationImpact = document.querySelector("#formulaDerivationImpact");
  const formulaDerivationWarning = document.querySelector("#formulaDerivationWarning");
  const formulaIncomingList = document.querySelector("#formulaIncomingList");
  const formulaIncomingSource = document.querySelector("#formulaIncomingSource");
  const formulaIncomingAdd = document.querySelector("#formulaIncomingAdd");
  const formulaNextRelation = document.querySelector("#formulaNextRelation");
  const formulaNextTarget = document.querySelector("#formulaNextTarget");
  const formulaNextSet = document.querySelector("#formulaNextSet");
  const formulaNextRemove = document.querySelector("#formulaNextRemove");
  const formulaDerivationCandidates = document.querySelector("#formulaDerivationCandidates");
  const formulaAdminGraph = document.querySelector("#formulaAdminGraph");
  const formulaAuthoringPopover = document.querySelector("#formulaAuthoringPopover");
  const formulaAuthoringDrawerBody = document.querySelector("#formulaAuthoringDrawerBody");
  const formulaAuthoringClose = document.querySelector("#formulaAuthoringClose");
  const formulaAuthoringWorkbenchButton = document.querySelector("#formulaAuthoringWorkbenchButton");
  const returnToArticleFormulaButton = document.querySelector("#returnToArticleFormulaButton");
  const formulaSelectionStatus = document.querySelector("#formulaSelectionStatus");
  const formulaExistingTab = document.querySelector("#formulaExistingTab");
  const formulaCreateTab = document.querySelector("#formulaCreateTab");
  const formulaExistingPane = document.querySelector("#formulaExistingPane");
  const formulaCreatePane = document.querySelector("#formulaCreatePane");
  const formulaAuthoringModule = document.querySelector("#formulaAuthoringModule");
  const formulaAuthoringCategory = document.querySelector("#formulaAuthoringCategory");
  const formulaAuthoringTag = document.querySelector("#formulaAuthoringTag");
  const formulaAuthoringQuery = document.querySelector("#formulaAuthoringQuery");
  const formulaAuthoringResults = document.querySelector("#formulaAuthoringResults");
  const formulaAuthoringPrevious = document.querySelector("#formulaAuthoringPrevious");
  const formulaAuthoringNext = document.querySelector("#formulaAuthoringNext");
  const formulaAuthoringPageStatus = document.querySelector("#formulaAuthoringPageStatus");
  const formulaAuthoringQuickPreview = document.querySelector("#formulaAuthoringQuickPreview");
  const formulaSelectionPreview = document.querySelector("#formulaSelectionPreview");
  const formulaCreateName = document.querySelector("#formulaCreateName");
  const formulaCreateModule = document.querySelector("#formulaCreateModule");
  const formulaCreateModuleButton = document.querySelector("#formulaCreateModuleButton");
  const formulaCreateCategory = document.querySelector("#formulaCreateCategory");
  const formulaCreateCategoryButton = document.querySelector("#formulaCreateCategoryButton");
  const formulaCreatePurpose = document.querySelector("#formulaCreatePurpose");
  const formulaCreateTagPicker = document.querySelector("#formulaCreateTagPicker");
  const formulaCreateTagAddButton = document.querySelector("#formulaCreateTagAddButton");
  const formulaCreateSelectedTags = document.querySelector("#formulaCreateSelectedTags");
  const formulaCreateTags = document.querySelector("#formulaCreateTags");
  const formulaCreateMarkdown = document.querySelector("#formulaCreateMarkdown");
  const formulaCreateAndBindButton = document.querySelector("#formulaCreateAndBindButton");
  const formulaDecisionPanel = document.querySelector("#formulaDecisionPanel");
  const formulaDecisionCount = document.querySelector("#formulaDecisionCount");
  const formulaDecisionList = document.querySelector("#formulaDecisionList");

  let editingType = null;
  let editingId = null;
  let formulaEditingCard = null;
  let formulaDerivationSearchTimer = null;
  let formulaAdminGraphInstance = null;
  const formulaDependencyPreview = new Map();
  let currentCover = "";
  let currentCoverCrop = null;
  let csrfToken = "";
  let serverContent = {
    posts: [],
    projects: [],
    knowledgeNodes: [],
    formulaReferenceDecisions: [],
    formulaRelationRepairs: [],
    siteLayout: { home: [] },
    publicFocusMode: { enabled: true },
    focusScopeCounts: {},
    carousel: {
      activeItems: [],
      buffered: [],
      conflicts: [],
      summary: { activeCount: 0, bufferedCount: 0, conflictCount: 0, focusEnabled: true }
    }
  };
  let isDirty = false;
  let isRestoringForm = false;
  let autosaveTimer = 0;
  let lastDraftSavedAt = "";
  let cropState = null;
  let cropPointerState = null;
  let layoutDragState = null;
  let formulaSearchTimer = 0;
  let formulaAuthoringSearchTimer = 0;
  let formulaDecisionCloneId = "";
  let formulaWorkbenchReturnState = null;
  let formulaAuthoringPointerSnapshot = null;
  let articleOperationInFlight = false;
  let pendingArticleAction = "";
  const feedbackOperationVersions = new Map();
  const toastEntries = new Map();
  const selectedContent = new Set();
  const filters = { search: "", type: "all", status: "all" };
  const featuredLimit = 4;
  const knowledgeColorTokens = ["purple", "blue", "green", "amber", "red", "neutral"];
  const formulaCatalogState = {
    facets: { modules: [], tags: [], classifications: [] },
    items: [],
    selection: { moduleKey: "", categoryPath: "", query: "", tag: "", archiveState: "all", publishStatus: "all" },
    pagination: { page: 1, pageSize: 12, total: 0, pageCount: 0 },
    loaded: false
  };
  const formulaRelationRepairState = {
    items: [],
    status: "pending",
    issueCode: "",
    loaded: false
  };
  let formulaClassifications = [];
  const formulaAuthoringState = {
    sourceMarkdown: "",
    baseSourceMarkdown: null,
    selectionStart: 0,
    selectionEnd: 0,
    selectionInfo: null,
    facets: { modules: [], tags: [] },
    items: [],
    moduleKey: "",
    categoryPath: "",
    tag: "",
    query: "",
    page: 1,
    pageSize: 6,
    pageCount: 0,
    total: 0,
    loaded: false,
    expanded: false,
    activeTab: "existing",
    editorScrollTop: 0,
    pageScrollY: 0,
    lastValidSelection: null
  };
  const formulaSnippets = [
    { key: "boost-duty-cycle", label: "BOOST 占空比 D", latex: "D = 1 - \\frac{V_{in}\\eta}{V_{out}}" },
    { key: "boost-inductor-ripple", label: "电感纹波 Delta I_L", latex: "\\Delta I_L = \\frac{V_{in}D}{L f_s}" },
    { key: "boost-inductor-value", label: "电感量下限 L", latex: "L \\ge \\frac{V_{in}D}{\\Delta I_L f_s}" },
    { key: "boost-average-current", label: "平均电感电流", latex: "I_{L,avg} = \\frac{I_{out}}{1-D}" },
    { key: "boost-peak-current", label: "峰值电感电流", latex: "I_{L,peak} = I_{L,avg} + \\frac{\\Delta I_L}{2}" },
    { key: "math-double-angle", label: "纯数学二倍角", latex: "\\sin(2\\theta)=2\\sin\\theta\\cos\\theta" }
  ];
  const boostTemplates = [
    {
      slug: "boost-inductor-selection-sheet",
      symbol: "BOOST-L",
      title: "BOOST 电感选型计算书",
      summary: "以 12V 升 24V/2A 为例，从拓扑占空比、纹波目标、电感量、电流等级、损耗和料号裕量完成中文 BOOST 电感选型。",
      accentColor: "green",
      tags: "BOOST, 电感设计, 计算书, 选型",
      markdown: `# BOOST 电感选型计算书

本计算书用于先给出工程结论，再把必要公式的来龙去脉收进公式右上角跳转标记。只有公式推导使用跳转标记；料号取舍属于工程判断，直接写在计算书内。

| 参数 | 符号 | 示例值 |
| --- | --- | --- |
| 输入电压 | $V_{in}$ | 12 V |
| 输出电压 | $V_{out}$ | 24 V |
| 输出电流 | $I_{out}$ | 2 A |
| 估算效率 | $\\eta$ | 0.90 |
| 开关频率 | $f_s$ | 200 kHz |
| 目标纹波比例 | $r$ | 约 30% |
| 环境假设 | - | 常温原型验证，后续按热测试修正 |

## 1. BOOST 拓扑占空比

$$
D = 1 - \\frac{V_{in}\\eta}{V_{out}}
$$
{{derive:boost-duty-cycle-ccm|BOOST拓扑占空比推导（CCM）|purple}}

代入 $V_{in}=12V$、$V_{out}=24V$、$\\eta=0.90$，得到 $D \\approx 0.55$。理想 CCM 关系对应 $D=0.50$；这里提高到 0.55 是把效率损失折进设计估算，便于后续电流与电感量留裕量。

## 2. 输出功率与平均电感电流

输出功率：

$$
P_{out}=V_{out}I_{out}=24V\\times2A=48W
$$

输入功率估算：

$$
P_{in}\\approx \\frac{P_{out}}{\\eta}=53.3W
$$

连续电流模式下，电感平均电流就是输入侧平均电流。也可以用 BOOST 关断占比关系估算：

$$
I_{L,avg} = \\frac{I_{out}}{1-D}
$$
{{derive:boost-inductor-current-rating|BOOST电感电流等级推导（CCM）|amber}}

代入 $I_{out}=2A$、$D=0.55$，得到 $I_{L,avg} \\approx 4.44A$。它也等于 $P_{in}/V_{in}\\approx53.3W/12V$，两种估算在这个效率折算方式下相互印证。

## 3. 纹波目标

先按平均电感电流的约 30% 设定纹波目标：

$$
\\Delta I_{L,target}=r I_{L,avg}\\approx0.3\\times4.44A=1.33A
$$

这个比例不是拓扑公式，而是效率、瞬态、体积和成本之间的初选折中。

## 4. 电感量下限

$$
L \\ge \\frac{V_{in}D}{\\Delta I_L f_s}
$$
{{derive:boost-inductor-value|BOOST电感量下限推导|green}}

代入后 $L \\ge 24.8\\mu H$，工程上先选标准值 33 uH。

## 5. 用标准值反算实际纹波

选定 33 uH 后，必须反算真实纹波，避免只停留在理论下限：

$$
\\Delta I_L = \\frac{V_{in}D}{L f_s}
$$
{{derive:boost-inductor-ripple|BOOST电感纹波电流推导（CCM）|blue}}

33 uH、200 kHz 下的纹波约 $1.0A$，约为平均电流的 23%，可以进入料号筛选。

## 6. 峰值、RMS 与饱和裕量

$$
I_{L,peak} = I_{L,avg} + \\frac{\\Delta I_L}{2}
$$
{{derive:boost-inductor-current-rating|BOOST电感电流等级推导（CCM）|amber}}

代入 $I_{L,avg}=4.44A$、$\\Delta I_L=1.0A$，得到 $I_{L,peak} \\approx 4.94A$。RMS 电流可按三角纹波近似估算：

$$
I_{L,rms}\\approx\\sqrt{I_{L,avg}^2+\\frac{\\Delta I_L^2}{12}}
$$
{{derive:boost-inductor-current-rating|BOOST电感电流等级推导（CCM）|amber}}

本例 $I_{L,rms}\\approx4.45A$。建议饱和电流不低于 6.5A，额定 RMS 电流不低于 5A，并复核高温下电感量下降曲线。

## 7. 损耗、温升与料号取舍

料号取舍不需要跳转到推导页，直接在计算书内形成工程约束：

| 项目 | 计算结论 | 选型动作 |
| --- | --- | --- |
| 电感量 | $L_{min} \\approx 24.8\\mu H$ | 标准值先选 33 uH |
| 峰值电流 | $I_{L,peak} \\approx 4.94A$ | $I_{sat}$ 建议不低于 6.5A |
| RMS 电流 | $I_{L,rms}\\approx4.45A$ | 额定温升电流建议不低于 5A |
| 直流电阻 | $P_{DCR}\\approx I_{L,rms}^2DCR$ | 优先低 DCR，但不要牺牲饱和裕量 |
| 频率特性 | 200 kHz 开关 | SRF 显著高于工作频率，确认磁芯损耗 |
| 温升 | 由铜损、磁芯损耗和散热决定 | 样机满载热测后修正料号 |

## 8. 推荐起点

本例的第一轮料号筛选建议：

| 选型项 | 推荐起点 |
| --- | --- |
| 标称电感量 | 33 uH |
| 饱和电流 | 不低于 6.5 A，优先查看高温降额曲线 |
| 温升电流 | 不低于 5 A |
| DCR | 在尺寸允许下尽量低，先按 20 mΩ 到 40 mΩ 区间筛选 |
| 结构 | 屏蔽功率电感优先，兼顾 EMI 和热路径 |

结论：33 uH、$I_{sat}\\ge6.5A$、$I_{rms}\\ge5A$ 的屏蔽功率电感可以作为本设计第一轮样机起点。后续以实测纹波、温升、效率和瞬态响应确认是否调整到 22 uH 或 47 uH。`
    },
    {
      slug: "boost-duty-cycle-ccm",
      symbol: "D.boost",
      title: "BOOST拓扑占空比推导（CCM）",
      summary: "从 BOOST 拓扑在 CCM 下的电感伏秒平衡推出理想占空比关系，并说明效率修正只是工程估算。",
      accentColor: "purple",
      tags: "BOOST, 电感设计, CCM, 占空比, 伏秒平衡",
      markdown: `# BOOST拓扑占空比推导（CCM）

公式唯一标识（CMS slug）：\`boost-duty-cycle-ccm\`

这个节点用于推导计算书中的 BOOST 拓扑占空比。推导边界是连续电流模式 CCM、稳态工作、理想开关和理想二极管；效率修正只作为后续工程估算。

## 1. 开关导通阶段

开关导通时间为 $D T_s$。二极管截止，电感一端接输入电压，另一端近似接地，因此电感电压近似为：

$$
V_{L,on}=V_{in}
$$

## 2. 开关关断阶段

关断时间为 $(1-D)T_s$。电感经二极管向输出端释放能量，电感电压近似为：

$$
V_{L,off}=V_{in}-V_{out}
$$

## 3. CCM 稳态伏秒平衡

稳态下电感一个周期内平均电压为 0：

$$
V_{in}D T_s + (V_{in}-V_{out})(1-D)T_s = 0
$$

约去 $T_s$ 并展开：

$$
V_{in}D + V_{in}(1-D)-V_{out}(1-D)=0
$$

得到：

$$
V_{in}=V_{out}(1-D)
$$

因此理想 BOOST 电压关系为：

$$
V_{out}=\\frac{V_{in}}{1-D}
$$

整理得到理想占空比：

$$
D = 1 - \\frac{V_{in}}{V_{out}}
$$

计算书中使用的工程估算把效率折进输入到输出的电压关系：

$$
D \\approx 1 - \\frac{V_{in}\\eta}{V_{out}}
$$

例如 $V_{in}=12V$、$V_{out}=24V$、$\\eta=0.90$ 时，$D \\approx 0.55$。这个值不是理想推导本身，而是带效率预估的设计入口。

返回上一级计算书：[BOOST 电感选型计算书](./derive.html?slug=boost-inductor-selection-sheet)`
    },
    {
      slug: "boost-inductor-ripple",
      symbol: "Delta I_L",
      title: "BOOST电感纹波电流推导（CCM）",
      summary: "从电感电压电流关系推导 BOOST CCM 导通阶段的电感纹波电流公式。",
      accentColor: "blue",
      tags: "BOOST, 电感设计, 纹波电流",
      markdown: `# BOOST电感纹波电流推导（CCM）

公式唯一标识（CMS slug）：\`boost-inductor-ripple\`

电感的基本关系为：

$$
V_L=L\\frac{di_L}{dt}
$$

在 BOOST 开关导通阶段，电感两端电压近似为 $V_{in}$，导通时间为 $D T_s$，因此电感电流增量为：

$$
\\Delta I_L=\\frac{V_{in}}{L}D T_s
$$

又因为 $T_s=1/f_s$，得到：

$$
\\Delta I_L = \\frac{V_{in}D}{L f_s}
$$

纹波目标通常按平均电感电流的 20% 到 40% 初选。纹波越小，所需电感量越大，瞬态响应也会变慢。

返回上一级计算书：[BOOST 电感选型计算书](./derive.html?slug=boost-inductor-selection-sheet)`
    },
    {
      slug: "boost-inductor-value",
      symbol: "L.boost",
      title: "BOOST电感量下限推导",
      summary: "由目标电感纹波反推满足纹波要求的 BOOST 电感量下限。",
      accentColor: "green",
      tags: "BOOST, 电感设计, Lmin",
      markdown: `# BOOST电感量下限推导

公式唯一标识（CMS slug）：\`boost-inductor-value\`

从电感纹波公式开始：

$$
\\Delta I_L = \\frac{V_{in}D}{L f_s}
$$

当设计给定最大允许纹波 $\\Delta I_{L,target}$ 时，为了不超过该纹波，需要满足：

$$
L \\ge \\frac{V_{in}D}{\\Delta I_L f_s}
$$

如果计算值落在标准料号之间，通常向上选择，并重新检查纹波、体积和直流电阻。

返回上一级计算书：[BOOST 电感选型计算书](./derive.html?slug=boost-inductor-selection-sheet)`
    },
    {
      slug: "boost-inductor-current-rating",
      symbol: "I_L.peak",
      title: "BOOST电感电流等级推导（CCM）",
      summary: "推导 BOOST CCM 电感平均电流、峰值电流和三角纹波 RMS 估算，用于饱和电流与温升电流选型。",
      accentColor: "amber",
      tags: "BOOST, 电感设计, 饱和电流",
      markdown: `# BOOST电感电流等级推导（CCM）

公式唯一标识（CMS slug）：\`boost-inductor-current-rating\`

## 1. 平均电感电流

BOOST 在 CCM 下，电感电流的平均值就是输入侧平均电流。理想情况下，二极管只在关断阶段向输出传能，因此输出平均电流约为：

$$
I_{out}=I_{L,avg}(1-D)
$$

整理得到：

$$
I_{L,avg} = \\frac{I_{out}}{1-D}
$$

实际设计中还应结合效率、输入电压范围和负载瞬态，把这个平均值作为电流等级的最低估算。

## 2. 峰值电感电流

电感纹波近似为围绕平均值上下摆动的三角波，所以峰值电流需要叠加半个纹波电流：

$$
I_{L,peak} = I_{L,avg} + \\frac{\\Delta I_L}{2}
$$

饱和电流必须高于该峰值，并额外考虑高温降额和短时过载。

## 3. RMS 电流估算

若把电感电流看成平均值叠加零均值三角纹波，三角纹波的 RMS 为 $\\Delta I_L/\\sqrt{12}$，因此：

$$
I_{L,rms}\\approx\\sqrt{I_{L,avg}^2+\\frac{\\Delta I_L^2}{12}}
$$

这个 RMS 值主要用于估算 DCR 铜损和温升电流，而不是饱和电流。

返回上一级计算书：[BOOST 电感选型计算书](./derive.html?slug=boost-inductor-selection-sheet)`
    },
    {
      slug: "boost-inductor-options",
      symbol: "L.part",
      title: "BOOST电感料号取舍清单",
      summary: "把电感量、饱和电流、直流电阻、频率特性、体积和温升放在一起做工程取舍；该页不是公式推导页。",
      accentColor: "neutral",
      tags: "BOOST, 电感设计, 选型",
      markdown: `# BOOST电感料号取舍清单

这个节点是工程选型清单，不是公式推导页，因此不应该作为计算书里的公式上角标跳转目标。完成公式估算后，实际料号还需要按损耗、温升和供应链做取舍。

| 关注项 | 选型判断 |
| --- | --- |
| 电感量 | 不低于计算下限，必要时按标准值向上取整 |
| 饱和电流 | 高于 $I_{L,peak}$，并保留温度和瞬态裕量 |
| 直流电阻 | 越低越有利于效率，但体积和成本会上升 |
| 频率特性 | 确认目标 $f_s$ 下的磁芯损耗和电感衰减 |

返回上一级计算书：[BOOST 电感选型计算书](./derive.html?slug=boost-inductor-selection-sheet)`
    },
    {
      slug: "math-double-angle-formula",
      symbol: "纯数学推导",
      title: "纯数学推导 - 二倍角公式",
      summary: "从和角公式推出二倍角关系，用作后续交流量、相位或 RMS 推导时的数学支撑节点。",
      accentColor: "blue",
      tags: "纯数学, 三角函数, 二倍角公式",
      markdown: `# 纯数学推导 - 二倍角公式

这是一个纯数学支持节点，和 BOOST 工程结论分开显示。它用于说明公式库也可以承载基础数学推导。

从正弦和角公式开始：

$$
\\sin(\\alpha + \\beta) = \\sin\\alpha\\cos\\beta + \\cos\\alpha\\sin\\beta
$$

令 $\\alpha=\\beta=\\theta$，得到：

$$
\\sin(2\\theta)=2\\sin\\theta\\cos\\theta
$$

同理，余弦二倍角可以写成：

$$
\\cos(2\\theta)=\\cos^2\\theta-\\sin^2\\theta
$$

后续若某个工程计算书真的使用三角恒等式，可以在对应公式旁用小图标跳转到这个纯数学推导页。`
    }
  ];
  const defaultLayoutPages = [
    {
      key: "home",
      label: "首页",
      sections: [
        { key: "hero", label: "首页首屏", description: "首页第一屏大海报与轮播内容。", order: 1, visible: true, size: "hero", preview: "hero" },
        { key: "recommended", label: "推荐内容", description: "按文章主分类与推荐优先级生成的推荐海报和列表。", order: 2, visible: true, size: "wide", preview: "recommended" },
        { key: "projects", label: "开源项目", description: "游客端首页的开源项目区。", order: 3, visible: true, size: "wide", preview: "cards" },
        { key: "miniapps", label: "网页小程序", description: "MD2File、LarkixElec 等工具入口，默认排在页面底部。", order: 4, visible: true, size: "wide", preview: "miniapps" }
      ]
    },
    {
      key: "category",
      label: "分类课程页",
      sections: [
        { key: "categoryHeader", label: "标题与搜索", description: "分类页顶部标题、摘要、搜索和返回入口。", order: 1, visible: true, size: "compact", preview: "header" },
        { key: "courseContent", label: "课程内容与推荐", description: "课程大纲、推荐起点、文章列表和相关项目。", order: 2, visible: true, size: "hero", preview: "course" }
      ]
    },
    {
      key: "projectsPage",
      label: "开源项目页",
      sections: [
        { key: "projectsHeader", label: "项目页标题", description: "开源项目页顶部标题、摘要和返回入口。", order: 1, visible: true, size: "compact", preview: "header" },
        { key: "projectList", label: "项目列表", description: "公开项目卡片列表。", order: 2, visible: true, size: "hero", preview: "cards" }
      ]
    },
    {
      key: "miniappsPage",
      label: "小程序中心",
      sections: [
        { key: "miniappsHeader", label: "小程序页标题", description: "小程序中心顶部标题、摘要和返回入口。", order: 1, visible: true, size: "compact", preview: "header" },
        { key: "miniappRegistry", label: "小程序列表", description: "网页小程序卡片列表。", order: 2, visible: true, size: "hero", preview: "miniapps" }
      ]
    },
    {
      key: "postPage",
      label: "文章详情页",
      sections: [
        { key: "postHero", label: "文章详情头图", description: "文章详情页顶部封面、分类和标题区。", order: 1, visible: true, size: "wide", preview: "hero" },
        { key: "postBody", label: "文章正文与目录", description: "文章目录和 Markdown 正文区域。", order: 2, visible: true, size: "hero", preview: "article" }
      ]
    },
    {
      key: "projectDetailPage",
      label: "项目详情页",
      sections: [
        { key: "projectHero", label: "项目详情头图", description: "项目详情页顶部封面、状态和标题区。", order: 1, visible: true, size: "wide", preview: "hero" },
        { key: "projectBody", label: "项目正文与目录", description: "项目目录和 Markdown 正文区域。", order: 2, visible: true, size: "hero", preview: "article" }
      ]
    }
  ];

  function storedBool(key) {
    return localStorage.getItem(key) === "true";
  }

  function setSidebarCollapsed(value) {
    dashboard.classList.toggle("is-sidebar-collapsed", value);
    sidebarToggle.setAttribute("aria-pressed", String(value));
    sidebarToggle.setAttribute("aria-label", value ? "展开侧栏" : "收缩侧栏");
    sidebarToggle.textContent = value ? "›" : "‹";
    localStorage.setItem(sidebarStateKey, String(value));
  }

  function setEditorDockCollapsed(value) {
    editorDock.classList.toggle("is-collapsed", value);
    editorDockToggle.textContent = value ? "展开" : "收起";
    editorDockHandle.setAttribute("aria-expanded", String(!value));
    editorDockState.textContent = value ? "已收起" : "展开";
    localStorage.setItem(editorDockStateKey, String(value));
  }

  function updatePasswordActive() {
    const password = loginForm.password;
    loginPanel.classList.toggle("is-password-active", document.activeElement === password || Boolean(password.value));
  }

  function setPasswordVisible(value) {
    loginForm.password.type = value ? "text" : "password";
    passwordToggle.textContent = value ? "隐藏" : "显示";
    passwordToggle.setAttribute("aria-label", value ? "隐藏密码" : "显示密码");
    passwordToggle.setAttribute("aria-pressed", String(value));
  }

  async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : operationTimeoutMs;
    const controller = options.signal ? null : new AbortController();
    const timeoutId = controller && timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : 0;
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    try {
      const response = await fetch(privateApiPath(path), {
        credentials: "same-origin",
        headers,
        ...fetchOptions,
        signal: fetchOptions.signal || controller?.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "请求失败");
      if (payload.csrfToken) csrfToken = payload.csrfToken;
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("请求超时，请检查网络后重试");
      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function loadServerContent() {
    const payload = await request("/api/admin/content");
    serverContent = {
      posts: payload.posts || [],
      projects: payload.projects || [],
      knowledgeNodes: payload.knowledgeNodes || [],
      formulaReferenceDecisions: payload.formulaReferenceDecisions || [],
      formulaRelationRepairs: payload.formulaRelationRepairs || [],
      siteLayout: payload.siteLayout || { home: [] },
      publicFocusMode: payload.publicFocusMode || { enabled: true },
      focusScopeCounts: payload.focusScopeCounts || {},
      carousel: payload.carousel || {
        activeItems: [],
        buffered: [],
        conflicts: [],
        summary: { activeCount: 0, bufferedCount: 0, conflictCount: 0, focusEnabled: true }
      }
    };
    if (
      formulaRelationRepairState.status === "pending" &&
      !formulaRelationRepairState.issueCode
    ) {
      formulaRelationRepairState.items = serverContent.formulaRelationRepairs;
      formulaRelationRepairState.loaded = true;
      renderFormulaRelationRepairs();
    }
    renderFocusModeGate();
  }

  async function confirmPublicPostProjection(postId) {
    const [content, detail] = await Promise.all([
      request(`/api/content?verify=${Date.now()}`),
      request(`/api/public/posts/${encodeURIComponent(postId)}?verify=${Date.now()}`)
    ]);
    const listed = (content.posts || []).find((post) => post.id === postId);
    if (!listed || detail.post?.id !== postId || listed.publishStatus !== "published") {
      throw new Error("文章已写入但公开投影尚未确认，请稍后重试发布检查");
    }
    return listed;
  }

  function focusModeEnabled() {
    return serverContent.publicFocusMode?.enabled === true;
  }

  function focusCategoryAllowed(category) {
    return ["电子基础", "电力电子", "开源项目"].includes(String(category || ""));
  }

  function syncFocusAuthoringControls() {
    const enabled = focusModeEnabled();
    const categorySelect = contentForm?.category;
    if (!categorySelect) return;
    [...categorySelect.options].forEach((option) => {
      const allowed = focusCategoryAllowed(option.value);
      option.hidden = enabled && !allowed;
      option.disabled = enabled && !allowed;
    });
    if (enabled && getType() === "post" && !focusCategoryAllowed(categorySelect.value)) {
      categorySelect.value = "电子基础";
    }
  }

  function renderFocusModeGate() {
    if (!focusModeGate || !focusModeToggle) return;
    const enabled = focusModeEnabled();
    focusModeToggle.checked = enabled;
    focusModeToggle.dataset.savedValue = String(enabled);
    focusModeToggle.setAttribute("aria-checked", String(enabled));
    if (saveFocusModeButton) saveFocusModeButton.disabled = true;
    const counts = serverContent.focusScopeCounts || {};
    const postCounts = counts.posts || {};
    const projectCounts = counts.projects || {};
    focusModeGateState.textContent = enabled
      ? `当前已开启：CMS 与游客端仅保留电子基础、公式推导、开源项目。文章 ${postCounts.visible ?? 0}/${postCounts.stored ?? 0}，项目 ${projectCounts.visible ?? 0}/${projectCounts.stored ?? 0}。`
      : `当前已关闭：CMS 恢复全部内容；游客端恢复所有原本已发布的内容。文章 ${postCounts.visible ?? 0}/${postCounts.stored ?? 0}。`;
    focusModeGateWarning.textContent = enabled
      ? "关闭后，非聚焦正文会恢复原可见性，但轮播缓冲项不会自动恢复；草稿仍保持草稿。"
      : "重新开启会把活跃的越界轮播项移入持久缓冲区，不会删除正文或改变发布状态。";
    focusModeGate.classList.toggle("is-enabled", enabled);
    syncFocusAuthoringControls();
  }

  async function saveFocusMode() {
    const enabled = focusModeToggle.checked;
    if (!enabled) {
      const confirmed = window.confirm(
        "确认关闭全站聚焦模式吗？非聚焦正文会恢复原可见性，草稿仍保持草稿；轮播缓冲项不会自动恢复，仍需由 Owner 明确选择槽位。"
      );
      if (!confirmed) {
        focusModeToggle.checked = true;
        renderFocusModeGate();
        return;
      }
    }
    focusModeToggle.disabled = true;
    try {
      const result = await request("/api/admin/focus-mode", {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
      serverContent.publicFocusMode = result.publicFocusMode;
      serverContent.focusScopeCounts = result.focusScopeCounts || {};
      serverContent.carousel = result.carousel || serverContent.carousel;
      const bufferedNow = Number(result.carouselReconciliation?.bufferedNow || 0);
      await loadServerContent();
      renderList();
      renderRecentContent();
      renderKnowledgeNodeList();
      renderFeaturedSlots();
      renderFormulaDecisions();
      setNotice(
        enabled
          ? `全站聚焦模式已开启；本次有 ${bufferedNow} 个越界轮播项进入缓冲区，原正文与发布状态保持不变。`
          : "全站聚焦模式已关闭；正文恢复原可见性，轮播缓冲项不会自动恢复，草稿仍保持草稿。",
        enabled ? "success" : "warning"
      );
    } finally {
      focusModeToggle.disabled = false;
      renderFocusModeGate();
    }
  }

  function setLoggedIn(value) {
    loginPanel.hidden = value;
    dashboard.hidden = !value;
    syncFormulaDrawerAvailability();
    syncArticlePublishDock();
  }

  function saveLogin(username) {
    localStorage.setItem(savedLoginKey, JSON.stringify({ username }));
  }

  function loadSavedLogin() {
    try {
      const saved = JSON.parse(localStorage.getItem(savedLoginKey) || "{}");
      if (saved.username) loginForm.username.value = saved.username;
    } catch {
      return;
    }
  }

  function toastIcon(type) {
    return { success: "OK", warning: "!", error: "!", info: "i" }[type] || "i";
  }

  function dismissToast(key = "cms-global", options = {}) {
    const entry = toastEntries.get(key);
    if (!entry) return;
    window.clearTimeout(entry.timerId);
    if (toastEntries.get(key) === entry) toastEntries.delete(key);
    const remove = () => {
      entry.element.remove();
    };
    if (options.immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      remove();
      return;
    }
    entry.element.classList.add("is-leaving");
    window.setTimeout(remove, 180);
  }

  function setNotice(message = "", type = "info", options = {}) {
    const normalizedType = ["success", "warning", "error", "info"].includes(type) ? type : "info";
    if (dashboard.hidden || !cmsToastRegion) {
      const target = dashboard.hidden ? loginNotice : adminNotice;
      if (!target) return;
      target.textContent = message;
      target.classList.remove("is-success", "is-warning", "is-error");
      if (message && normalizedType !== "info") target.classList.add(`is-${normalizedType}`);
      return;
    }

    const key = String(options.key || "cms-global");
    if (!message) {
      dismissToast(key);
      return;
    }
    const persistent = options.persistent ?? normalizedType === "error";
    const existing = toastEntries.get(key);
    const element = existing?.element || document.createElement("article");
    window.clearTimeout(existing?.timerId);
    element.className = `cms-toast is-${normalizedType}`;
    element.dataset.toastKey = key;
    element.setAttribute("role", persistent ? "alert" : "status");
    element.setAttribute("aria-atomic", "true");
    element.innerHTML = `
      <span class="cms-toast-icon" aria-hidden="true">${toastIcon(normalizedType)}</span>
      <span class="cms-toast-message"></span>
      <button class="cms-toast-close" type="button" aria-label="关闭提示" title="关闭提示">&times;</button>
    `;
    element.querySelector(".cms-toast-message").textContent = String(message);
    if (!existing) cmsToastRegion.append(element);
    const entry = { element, timerId: 0, persistent };
    toastEntries.set(key, entry);
    if (!persistent) {
      entry.timerId = window.setTimeout(() => dismissToast(key), 3000);
    }
  }

  function beginFeedbackOperation(key) {
    const version = (feedbackOperationVersions.get(key) || 0) + 1;
    feedbackOperationVersions.set(key, version);
    dismissToast(key, { immediate: true });
    return { key, version };
  }

  function setOperationNotice(operation, message, type = "info", options = {}) {
    if (!operation || feedbackOperationVersions.get(operation.key) !== operation.version) return false;
    setNotice(message, type, { ...options, key: operation.key });
    return true;
  }

  function setArticlePublishDockCollapsed(value, options = {}) {
    if (!articlePublishDock) return;
    articlePublishDock.classList.toggle("is-collapsed", value);
    articlePublishDockBody.hidden = value;
    articlePublishDockExpand.hidden = !value;
    articlePublishDockCollapse.setAttribute("aria-expanded", String(!value));
    articlePublishDockExpand.setAttribute("aria-expanded", String(!value));
    if (options.persist !== false) localStorage.setItem(articlePublishDockStateKey, String(value));
  }

  function syncVisualViewportOffset() {
    const viewport = window.visualViewport;
    const keyboardOffset = viewport
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      : 0;
    document.documentElement.style.setProperty("--cms-keyboard-offset", `${Math.round(keyboardOffset)}px`);
    document.documentElement.style.setProperty("--cms-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
    document.documentElement.classList.toggle("has-cms-keyboard", keyboardOffset > 80);
  }

  function currentEditingPost() {
    if (getType() !== "post" || !editingId) return null;
    return serverContent.posts.find((post) => post.id === editingId) || null;
  }

  function syncArticlePublishDock() {
    if (!articlePublishDock) return;
    const isArticle = getType() === "post";
    const visible = !dashboard.hidden && currentAdminView() === "editor" && isArticle;
    articlePublishDock.hidden = !visible;
    dashboard.classList.toggle("has-article-publish-dock", visible);
    if (nonArticleSaveButton) nonArticleSaveButton.hidden = isArticle;
    articlePublishDock.classList.toggle("has-formula-rail", !formulaAuthoringPopover?.hidden);
    articlePublishDock.classList.toggle("is-formula-drawer-open", Boolean(formulaAuthoringState.expanded));
    articlePublishDock.classList.toggle("is-dirty", isDirty);
    articlePublishDock.classList.toggle("is-busy", articleOperationInFlight);
    articlePublishDock.setAttribute("aria-busy", String(articleOperationInFlight));
    if (articlePublishDockStatus) {
      articlePublishDockStatus.textContent = articleOperationInFlight
        ? pendingArticleAction === "publish" ? "正在发布文章" : "正在保存草稿"
        : isDirty ? "有未保存修改" : "当前内容已保存";
    }
    const published = currentEditingPost()?.publishStatus === "published";
    if (articlePublishButton) articlePublishButton.textContent = published ? "更新发布" : "发布文章";
    if (articleSaveDraftButton) articleSaveDraftButton.disabled = articleOperationInFlight;
    if (articlePublishButton) articlePublishButton.disabled = articleOperationInFlight;
  }

  function requestArticleAction(action) {
    if (articleOperationInFlight) {
      setNotice("当前文章操作仍在进行，请等待结果。", "warning", { key: "article-operation" });
      return;
    }
    pendingArticleAction = action;
    contentForm.publishStatus.value = action === "publish" ? "published" : "draft";
    updateVisibilityHint();
    markDirty();
    syncArticlePublishDock();
    contentForm.requestSubmit();
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.idleText = button.textContent;
      button.textContent = label || "处理中...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.idleText || button.textContent;
      button.disabled = false;
      delete button.dataset.idleText;
    }
  }

  async function withBusy(button, label, task) {
    setBusy(button, true, label);
    try {
      return await task();
    } finally {
      setBusy(button, false);
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderMarkdown(markdown, options = {}) {
    const bindings =
      editingType === "post" && editingId
        ? serverContent.posts.find((item) => item.id === editingId)?.formulaBindings || []
        : [];
    if (window.LarkixMarkdown) {
      return window.LarkixMarkdown.render(markdown, {
        formulaBindings: bindings,
        formulaDependencies: options.formulaDependencies || [],
        formulaDependencyMode: options.formulaDependencyMode || "admin",
        formulaDependencyHref: "../derive.html?formula="
      }).html;
    }
    return `<p>${escapeHtml(markdown || "Markdown 预览会显示在这里。")}</p>`;
  }

  function populateFormulaAuthoringControls() {
    if (formulaSnippetSelect) {
      formulaSnippetSelect.innerHTML = formulaSnippets
        .map((snippet) => `<option value="${escapeHtml(snippet.key)}">${escapeHtml(snippet.label)}</option>`)
        .join("");
    }
    if (boostTemplateSelect) {
      boostTemplateSelect.innerHTML = boostTemplates
        .map((template) => `<option value="${escapeHtml(template.slug)}">${escapeHtml(template.title)}</option>`)
        .join("");
    }
  }

  function selectedFormulaSnippet() {
    const key = formulaSnippetSelect?.value || formulaSnippets[0]?.key;
    return formulaSnippets.find((snippet) => snippet.key === key) || formulaSnippets[0];
  }

  function selectedMarkdownText() {
    const field = contentForm.markdown;
    return field.value.slice(field.selectionStart || 0, field.selectionEnd || 0).trim();
  }

  function insertMarkdownText(text, options = {}) {
    const field = contentForm.markdown;
    const start = field.selectionStart || 0;
    const end = field.selectionEnd || 0;
    const before = field.value.slice(0, start);
    const after = field.value.slice(end);
    const prefix = options.block && before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = options.block && after && !after.startsWith("\n") ? "\n\n" : "";
    const inserted = `${prefix}${text}${suffix}`;
    field.value = `${before}${inserted}${after}`;
    const cursor = start + inserted.length;
    field.focus();
    field.setSelectionRange(cursor, cursor);
    updatePreview();
    markDirty();
  }

  function insertFormula(mode) {
    const snippet = selectedFormulaSnippet();
    const latex = selectedMarkdownText() || snippet?.latex || "V_{in}";
    if (mode === "display") {
      insertMarkdownText(`$$\n${latex}\n$$`, { block: true });
      setNotice("已插入块级公式。", "success");
      return;
    }
    insertMarkdownText(`$${latex}$`);
    setNotice("已插入行内公式。", "success");
  }

  function insertFormulaSnippet() {
    const snippet = selectedFormulaSnippet();
    if (!snippet) return;
    insertMarkdownText(`公式：$${snippet.latex}$\n\n$$\n${snippet.latex}\n$$`, { block: true });
    setNotice(`已插入公式片段：${snippet.label}。`, "success");
  }

  function formulaTokenIsEscaped(source, index) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
      slashCount += 1;
    }
    return slashCount % 2 === 1;
  }

  function formulaHasUnescapedToken(source, token) {
    let index = source.indexOf(token);
    while (index >= 0) {
      if (!formulaTokenIsEscaped(source, index)) return true;
      index = source.indexOf(token, index + token.length);
    }
    return false;
  }

  function parseCompleteLatexSelection(value) {
    const selectedText = String(value || "");
    const trimmed = selectedText.trim();
    const candidates = [
      { open: "$$", close: "$$", displayMode: "display", multiline: true, forbidden: ["$"] },
      { open: "\\[", close: "\\]", displayMode: "display", multiline: true, forbidden: ["\\[", "\\]"] },
      { open: "\\(", close: "\\)", displayMode: "inline", multiline: false, forbidden: ["\\(", "\\)"] },
      { open: "$", close: "$", displayMode: "inline", multiline: false, forbidden: ["$"] }
    ];
    for (const candidate of candidates) {
      if (!trimmed.startsWith(candidate.open) || !trimmed.endsWith(candidate.close)) continue;
      if (candidate.open === "$" && (trimmed.startsWith("$$") || trimmed.endsWith("$$"))) continue;
      const sourceLatex = trimmed.slice(candidate.open.length, -candidate.close.length);
      if (!sourceLatex.trim() || (!candidate.multiline && /[\r\n]/.test(sourceLatex))) continue;
      if (candidate.forbidden.some((token) => formulaHasUnescapedToken(sourceLatex, token))) continue;
      return {
        selectedText,
        latex: sourceLatex.trim(),
        displayMode: candidate.displayMode,
        openDelimiter: candidate.open,
        closeDelimiter: candidate.close,
        leadingWhitespace: selectedText.indexOf(trimmed),
        trailingWhitespace: selectedText.length - selectedText.indexOf(trimmed) - trimmed.length
      };
    }
    return null;
  }

  async function sha256Text(value) {
    if (!window.crypto?.subtle) throw new Error("当前浏览器不支持来源哈希校验，不能安全创建公式卡");
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function setFormulaAuthoringTab(tab) {
    const create = tab === "create";
    formulaAuthoringState.activeTab = create ? "create" : "existing";
    formulaExistingPane.hidden = create;
    formulaCreatePane.hidden = !create;
    formulaExistingTab.classList.toggle("is-active", !create);
    formulaCreateTab.classList.toggle("is-active", create);
    formulaExistingTab.setAttribute("aria-selected", String(!create));
    formulaCreateTab.setAttribute("aria-selected", String(create));
  }

  function formulaAuthoringCategoryOptions() {
    const modules = formulaAuthoringState.facets.modules || [];
    const selectedModule = formulaAuthoringState.moduleKey;
    return modules
      .filter((module) => !selectedModule || module.moduleKey === selectedModule)
      .flatMap((module) =>
        (module.categories || []).map((category) => ({
          moduleKey: module.moduleKey,
          categoryPath: category.categoryPath
        }))
      );
  }

  function renderFormulaAuthoringFilters() {
    const modules = formulaAuthoringState.facets.modules || [];
    const moduleValue = formulaAuthoringState.moduleKey;
    formulaAuthoringModule.innerHTML = `<option value="">全部模块</option>${modules
      .map((module) => `<option value="${escapeHtml(module.moduleKey)}">${escapeHtml(module.moduleKey)}（${module.activeCount || 0}）</option>`)
      .join("")}`;
    formulaAuthoringModule.value = moduleValue;

    const categories = formulaAuthoringCategoryOptions();
    formulaAuthoringCategory.innerHTML = `<option value="">全部分类</option>${categories
      .map(
        (category) =>
          `<option value="${escapeHtml(category.categoryPath)}" data-module="${escapeHtml(category.moduleKey)}">${escapeHtml(category.moduleKey)} / ${escapeHtml(category.categoryPath)}</option>`
      )
      .join("")}`;
    formulaAuthoringCategory.value = formulaAuthoringState.categoryPath;

    const tagValue = formulaAuthoringState.tag;
    formulaAuthoringTag.innerHTML = `<option value="">全部标签</option>${(formulaAuthoringState.facets.tags || [])
      .map((tag) => `<option value="${escapeHtml(tag.tagKey)}">${escapeHtml(tag.tagKey)}（${tag.activeCount || 0}）</option>`)
      .join("")}`;
    formulaAuthoringTag.value = tagValue;
    formulaAuthoringQuery.value = formulaAuthoringState.query;
  }

  function renderFormulaAuthoringResults() {
    const selectedFormula = formulaAuthoringState.selectionInfo;
    formulaAuthoringResults.innerHTML =
      formulaAuthoringState.items
        .map((card) => {
          const selectedMatches =
            selectedFormula &&
            selectedFormula.latex.replace(/\s+/g, "") === String(card.insertLatex || card.latex || "").trim().replace(/\s+/g, "");
          const insertActions = selectedFormula
            ? `<button class="button primary" type="button" data-formula-bind="${escapeHtml(card.formulaId)}" data-bind-mode="selection" ${
                selectedMatches ? "" : "disabled"
              }>${selectedMatches ? "绑定所选公式" : "所选 LaTeX 与此卡不同"}</button>`
            : `<button class="button secondary" type="button" data-formula-bind="${escapeHtml(card.formulaId)}" data-bind-mode="inline">行内插入</button>
               <button class="button primary" type="button" data-formula-bind="${escapeHtml(card.formulaId)}" data-bind-mode="display">块级插入</button>`;
          const actions = `<button class="button secondary" type="button" data-formula-preview="${escapeHtml(card.formulaId)}">快速预览</button>${insertActions}`;
          return `
            <article class="formula-authoring-result">
              <div>
                <strong>${escapeHtml(card.displayName)}</strong>
                <span>${escapeHtml(card.moduleKey)} / ${escapeHtml(card.categoryPath)}</span>
                <span class="formula-status-badge is-${escapeHtml(card.publishStatus || "draft")}">${
                  card.publishStatus === "published" ? (card.pendingPublication ? "已发布 · 有待发布修订" : "已发布") : "草稿 · 仅可绑定草稿文章"
                }</span>
                <code>${escapeHtml(card.formulaId)}</code>
              </div>
              <code class="formula-authoring-latex">${escapeHtml(card.insertLatex || card.latex || "")}</code>
              <div class="formula-authoring-result-actions">${actions}</div>
            </article>`;
        })
        .join("") ||
      `<div class="empty-state">${
        formulaAuthoringState.moduleKey || formulaAuthoringState.categoryPath || formulaAuthoringState.query || formulaAuthoringState.tag
          ? "当前条件下没有可用公式卡。"
          : "请选择分类，或输入关键词/标签搜索公式卡。"
      }</div>`;
    formulaAuthoringPageStatus.textContent = formulaAuthoringState.pageCount
      ? `第 ${formulaAuthoringState.page} / ${formulaAuthoringState.pageCount} 页，共 ${formulaAuthoringState.total} 条`
      : "暂无结果";
    formulaAuthoringPrevious.disabled = formulaAuthoringState.page <= 1;
    formulaAuthoringNext.disabled = !formulaAuthoringState.pageCount || formulaAuthoringState.page >= formulaAuthoringState.pageCount;
  }

  function renderFormulaAuthoringQuickPreview(card) {
    if (!formulaAuthoringQuickPreview || !card) return;
    const previewLabel =
      card.publishStatus === "draft"
        ? "当前草稿修订，仅在 CMS 中可用"
        : card.pendingPublication
          ? "已发布插入修订，待发布修改未进入此预览"
          : "已发布插入修订";
    formulaAuthoringQuickPreview.innerHTML = `
      <strong>${escapeHtml(card.displayName || card.formulaId)}</strong>
      <span>${escapeHtml(previewLabel)}</span>
      <div class="formula-authoring-latex">${formulaLatexHtml(card.insertLatex || card.latex || "")}</div>
    `;
    formulaAuthoringQuickPreview.hidden = false;
    formulaAuthoringQuickPreview.focus({ preventScroll: true });
  }

  async function loadFormulaAuthoringCatalog(options = {}) {
    const params = new URLSearchParams({
      authoring: "1",
      module: formulaAuthoringState.moduleKey,
      category: formulaAuthoringState.categoryPath,
      tag: formulaAuthoringState.tag,
      q: formulaAuthoringState.query,
      archiveState: "active",
      page: String(formulaAuthoringState.page),
      pageSize: String(formulaAuthoringState.pageSize)
    });
    const result = await request(`/api/admin/formulas?${params.toString()}`);
    formulaAuthoringState.facets = result.facets || { modules: [], tags: [] };
    formulaClassifications = formulaAuthoringState.facets.classifications || formulaClassifications;
    renderFormulaClassificationOptions();
    formulaAuthoringState.items = result.items || [];
    formulaAuthoringState.page = result.pagination?.page || 1;
    formulaAuthoringState.pageCount = result.pagination?.pageCount || 0;
    formulaAuthoringState.total = result.pagination?.total || 0;
    formulaAuthoringState.loaded = true;

    if (options.selectDefault && !formulaAuthoringState.moduleKey && !formulaAuthoringState.categoryPath && !formulaAuthoringState.query && !formulaAuthoringState.tag) {
      const firstModule = formulaAuthoringState.facets.modules?.[0];
      const firstCategory = firstModule?.categories?.[0];
      if (firstModule && firstCategory) {
        formulaAuthoringState.moduleKey = firstModule.moduleKey;
        formulaAuthoringState.categoryPath = firstCategory.categoryPath;
        formulaAuthoringState.page = 1;
        return loadFormulaAuthoringCatalog({ selectDefault: false });
      }
    }
    renderFormulaAuthoringFilters();
    renderFormulaAuthoringResults();
  }

  function captureFormulaEditorState() {
    const field = contentForm.markdown;
    const selectionStart = Number(field.selectionStart || 0);
    const selectionEnd = Number(field.selectionEnd || selectionStart);
    const selected = field.value.slice(selectionStart, selectionEnd);
    let selectionInfo = parseCompleteLatexSelection(selected);
    if (selectionInfo) {
      const formulaStart = selectionStart + selectionInfo.leadingWhitespace;
      const formulaEnd = selectionEnd - selectionInfo.trailingWhitespace;
      if (
        formulaTokenIsEscaped(field.value, formulaStart) ||
        (selectionInfo.openDelimiter.startsWith("$") &&
          (field.value[formulaStart - 1] === "$" || field.value[formulaEnd] === "$"))
      ) {
        selectionInfo = null;
      }
    }
    const storedPost =
      editingType === "post" && editingId
        ? serverContent.posts.find((item) => item.id === editingId)
        : null;
    formulaAuthoringState.sourceMarkdown = field.value;
    formulaAuthoringState.baseSourceMarkdown = storedPost
      ? String(storedPost.markdown || "")
      : null;
    formulaAuthoringState.selectionStart = selectionStart;
    formulaAuthoringState.selectionEnd = selectionEnd;
    formulaAuthoringState.selectionInfo = selectionInfo;
    formulaAuthoringState.editorScrollTop = field.scrollTop;
    formulaAuthoringState.pageScrollY = window.scrollY;
    if (selectionInfo) {
      formulaAuthoringState.lastValidSelection = {
        sourceMarkdown: field.value,
        selectionStart,
        selectionEnd,
        selectionInfo
      };
    }
    return { selectionInfo, hasSelection: selectionEnd > selectionStart };
  }

  function restoreFormulaPageScroll(pageScrollY = formulaAuthoringState.pageScrollY) {
    const restore = () => window.scrollTo(0, pageScrollY);
    restore();
    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    window.setTimeout(restore, 190);
  }

  function restoreFormulaEditorState(options = {}) {
    const field = contentForm.markdown;
    if (field.value !== formulaAuthoringState.sourceMarkdown) return false;
    const selectionStart = Math.min(formulaAuthoringState.selectionStart, field.value.length);
    const selectionEnd = Math.min(formulaAuthoringState.selectionEnd, field.value.length);
    field.setSelectionRange(selectionStart, selectionEnd);
    field.scrollTop = formulaAuthoringState.editorScrollTop;
    if (options.focus !== false) field.focus({ preventScroll: true });
    restoreFormulaPageScroll();
    return true;
  }

  function setFormulaDrawerExpanded(expanded, options = {}) {
    formulaAuthoringState.expanded = Boolean(expanded);
    formulaAuthoringPopover.classList.toggle("is-collapsed", !formulaAuthoringState.expanded);
    dashboard.classList.toggle("is-formula-drawer-open", formulaAuthoringState.expanded);
    openFormulaAuthoringButton.setAttribute("aria-expanded", String(formulaAuthoringState.expanded));
    openFormulaAuthoringButton.setAttribute(
      "aria-label",
      formulaAuthoringState.expanded ? "公式创作抽屉已展开" : "展开公式创作抽屉"
    );
    openFormulaAuthoringButton.title = formulaAuthoringState.expanded ? "公式创作抽屉已展开" : "展开公式创作抽屉";
    formulaAuthoringDrawerBody?.setAttribute("aria-hidden", String(!formulaAuthoringState.expanded));
    syncArticlePublishDock();
    if (!formulaAuthoringState.expanded) {
      if (options.restoreEditor !== false) restoreFormulaEditorState();
      return;
    }
    window.requestAnimationFrame(() => {
      restoreFormulaPageScroll();
      if (options.focus === false) return;
      const target =
        formulaAuthoringState.activeTab === "create" && !formulaCreateTab.disabled
          ? formulaCreateName
          : formulaAuthoringQuery;
      target?.focus({ preventScroll: true });
    });
  }

  function syncFormulaDrawerAvailability() {
    if (!formulaAuthoringPopover) return;
    const available = !dashboard.hidden && currentAdminView() === "editor" && getType() === "post";
    formulaAuthoringPopover.hidden = !available;
    dashboard.classList.toggle("has-formula-authoring", available);
    if (!available) {
      formulaAuthoringState.expanded = false;
      formulaAuthoringPopover.classList.add("is-collapsed");
      dashboard.classList.remove("is-formula-drawer-open");
    }
    syncArticlePublishDock();
  }

  function updateFormulaSelectionStatus(selectionInfo, hasSelection) {
    formulaAuthoringState.selectionInfo = selectionInfo;
    if (selectionInfo) {
      formulaSelectionStatus.textContent = `已识别一个完整${selectionInfo.displayMode === "display" ? "块级" : "行内"}公式。可创建新卡，或绑定 LaTeX 完全一致的已有卡。`;
      formulaSelectionPreview.innerHTML = formulaLatexHtml(selectionInfo.latex);
    } else if (hasSelection) {
      formulaSelectionStatus.textContent = "当前选区不是一个完整公式；不会替换正文。请重新框选一个完整的 $...$、$$...$$、\\(...\\) 或 \\[...\\] 公式。";
      formulaSelectionPreview.textContent = "选区包含正文、残缺定界符或多个公式，不能创建公式卡。";
    } else {
      formulaSelectionStatus.textContent = "未框选公式：可在当前光标处插入已有公式卡。Shift + 右键仍打开浏览器原生菜单。";
      formulaSelectionPreview.textContent = "请先在 Markdown 正文中框选一个完整公式。";
    }
    formulaCreateTab.disabled = !selectionInfo;
    formulaCreateAndBindButton.disabled = !selectionInfo;
  }

  function openFormulaAuthoring(event) {
    if (getType() !== "post") {
      setNotice("公式卡引用仅用于文章编辑；推导节点继续使用现有公式与跳转工具。", "warning");
      return;
    }
    const pendingSnapshot = formulaAuthoringPointerSnapshot;
    formulaAuthoringPointerSnapshot = null;
    const captured =
      pendingSnapshot && performance.now() - pendingSnapshot.capturedAt < 1500
        ? pendingSnapshot.captured
        : captureFormulaEditorState();
    updateFormulaSelectionStatus(captured.selectionInfo, captured.hasSelection);
    setFormulaAuthoringTab(captured.selectionInfo ? "create" : "existing");
    setFormulaDrawerExpanded(true);
    loadFormulaAuthoringCatalog({ selectDefault: !formulaAuthoringState.loaded }).catch((error) => setNotice(error.message, "error"));
  }

  function closeFormulaAuthoring(options = {}) {
    setFormulaDrawerExpanded(false, options);
  }

  function openFormulaWorkbenchFromArticle() {
    captureFormulaEditorState();
    formulaWorkbenchReturnState = {
      sourceMarkdown: formulaAuthoringState.sourceMarkdown,
      baseSourceMarkdown: formulaAuthoringState.baseSourceMarkdown,
      selectionStart: formulaAuthoringState.selectionStart,
      selectionEnd: formulaAuthoringState.selectionEnd,
      selectionInfo: formulaAuthoringState.selectionInfo,
      editorScrollTop: formulaAuthoringState.editorScrollTop,
      pageScrollY: formulaAuthoringState.pageScrollY,
      activeTab: formulaAuthoringState.activeTab
    };
    saveDraft();
    closeFormulaAuthoring({ restoreEditor: false });
    window.location.hash = "formulas";
  }

  function returnToArticleFormula() {
    const snapshot = formulaWorkbenchReturnState;
    if (!snapshot) return;
    window.location.hash = "editor";
    setAdminView("editor");
    window.requestAnimationFrame(() => {
      if (contentForm.markdown.value !== snapshot.sourceMarkdown) {
        setNotice("文章正文已变化，未自动覆盖；请重新选择公式插入位置。", "warning");
        formulaWorkbenchReturnState = null;
        if (returnToArticleFormulaButton) returnToArticleFormulaButton.hidden = true;
        return;
      }
      Object.assign(formulaAuthoringState, snapshot, {
        loaded: false,
        expanded: true
      });
      updateFormulaSelectionStatus(snapshot.selectionInfo, snapshot.selectionEnd > snapshot.selectionStart);
      setFormulaAuthoringTab(snapshot.activeTab === "create" && snapshot.selectionInfo ? "create" : "existing");
      restoreFormulaEditorState({ focus: false });
      setFormulaDrawerExpanded(true);
      loadFormulaAuthoringCatalog({ selectDefault: true }).catch((error) => setNotice(error.message, "error"));
      formulaWorkbenchReturnState = null;
      if (returnToArticleFormulaButton) returnToArticleFormulaButton.hidden = true;
    });
  }

  function newFormulaBindingId() {
    if (window.crypto?.randomUUID) return `bind.${window.crypto.randomUUID()}`;
    return `bind.${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function appendFormulaBindingToSelection(source, start, end, shortcode, displayMode) {
    const before = source.slice(0, end);
    const after = source.slice(end);
    if (displayMode === "display") {
      const leadingBreak = before.endsWith("\n") ? "" : "\n";
      const trailingBreak = after.startsWith("\n") || !after ? "" : "\n";
      const inserted = `${leadingBreak}${shortcode}${trailingBreak}`;
      return {
        value: `${before}${inserted}${after}`,
        cursor: end + inserted.length
      };
    }
    return {
      value: `${before}${shortcode}${after}`,
      cursor: end + shortcode.length
    };
  }

  function insertExistingFormulaBinding(card, requestedMode) {
    const field = contentForm.markdown;
    if (field.value !== formulaAuthoringState.sourceMarkdown) {
      throw new Error("打开公式浮窗后正文已变化，请关闭浮窗并重新操作");
    }
    const hasSelection = formulaAuthoringState.selectionEnd > formulaAuthoringState.selectionStart;
    if (hasSelection && !formulaAuthoringState.selectionInfo) {
      throw new Error("当前选区不是一个完整公式，已保留原文");
    }
    let mode = requestedMode;
    if (formulaAuthoringState.selectionInfo) {
      const sameLatex =
        formulaAuthoringState.selectionInfo.latex.replace(/\s+/g, "") ===
        String(card.insertLatex || card.latex || "").trim().replace(/\s+/g, "");
      if (!sameLatex) throw new Error("所选 LaTeX 与目标公式卡不同，已保留原文");
      mode = formulaAuthoringState.selectionInfo.displayMode;
    }
    const revisionId = card.insertRevisionId || card.currentRevisionId;
    if (!revisionId) throw new Error("该公式卡没有可插入的修订");
    const shortcode = `{{formula:${newFormulaBindingId()}|${card.formulaId}|${revisionId}|${mode}}}`;
    const start = formulaAuthoringState.selectionStart;
    const end = formulaAuthoringState.selectionEnd;
    let inserted = shortcode;
    let nextValue = "";
    let cursor = start + shortcode.length;
    if (hasSelection) {
      const bound = appendFormulaBindingToSelection(field.value, start, end, shortcode, mode);
      nextValue = bound.value;
      cursor = bound.cursor;
    }
    if (!hasSelection && mode === "display") {
      const before = field.value.slice(0, start);
      const after = field.value.slice(end);
      inserted = `${before && !before.endsWith("\n") ? "\n\n" : ""}${shortcode}${after && !after.startsWith("\n") ? "\n\n" : ""}`;
    }
    if (!hasSelection) {
      nextValue = `${field.value.slice(0, start)}${inserted}${field.value.slice(end)}`;
      cursor = start + inserted.length;
    }
    field.value = nextValue;
    field.focus();
    field.setSelectionRange(cursor, cursor);
    updatePreview();
    markDirty();
    closeFormulaAuthoring();
    setNotice(`已保留原公式并追加公式卡绑定：${card.displayName}。保存文章后生效。`, "success");
  }

  async function createFormulaCardFromSelection() {
    if (!formulaAuthoringState.selectionInfo) throw new Error("请先框选一个完整的 LaTeX 公式");
    if (contentForm.markdown.value !== formulaAuthoringState.sourceMarkdown) {
      throw new Error("打开公式浮窗后正文已变化，请关闭浮窗并重新框选");
    }
    const displayName = formulaCreateName.value.trim();
    const module = selectedFormulaCreateModule();
    const category = selectedFormulaCreateCategory(module?.slug || "");
    if (!displayName || !formulaCreateModule.value.trim() || !formulaCreateCategory.value.trim()) {
      throw new Error("请填写公式名称、所属模块和自定义分类");
    }
    if (!module) throw new Error("请选择已有模块，或明确点击“新增模块”后再保存");
    if (!category) throw new Error("请选择已有主分类，或明确点击“新增主分类”后再保存");
    const built = buildPayload();
    if (built.collectionKey !== "posts") throw new Error("选中公式建卡仅支持文章");
    if (built.payload.publishStatus === "published") {
      throw new Error("新公式卡默认为草稿。请先把文章保存为草稿，创建并绑定公式卡；发布公式卡后再发布文章。");
    }
    validateFeaturedPayload(built.payload);
    saveDraft();
    const sourceHash = await sha256Text(formulaAuthoringState.sourceMarkdown);
    const baseSourceHash = formulaAuthoringState.baseSourceMarkdown !== null
      ? await sha256Text(formulaAuthoringState.baseSourceMarkdown)
      : "";
    const result = await request("/api/admin/formulas/from-selection", {
      method: "POST",
      body: JSON.stringify({
        post: built.payload,
        sourceHash,
        baseSourceHash,
        selectionStart: formulaAuthoringState.selectionStart,
        selectionEnd: formulaAuthoringState.selectionEnd,
        formula: {
          displayName,
          moduleKey: module.slug,
          categoryPath: category.displayName,
          purpose: formulaCreatePurpose.value.trim(),
          markdownDerivation: formulaCreateMarkdown?.value || "",
          tags: formulaCreateTagValues()
        }
      })
    });
    serverContent = {
      ...serverContent,
      posts: result.posts || [],
      carousel: result.carousel || serverContent.carousel
    };
    applyItemToForm("post", result.post, { confirm: false });
    contentForm.markdown.focus();
    contentForm.markdown.setSelectionRange(result.selection.cursor, result.selection.cursor);
    clearDraft();
    markClean();
    renderList();
    renderRecentContent();
    renderFeaturedSlots();
    formulaAuthoringState.loaded = false;
    closeFormulaAuthoring();
    setNotice(
      `已创建草稿公式卡“${result.card.displayName}”，原公式保持不变，文章已原子保存并绑定。`,
      "success"
    );
  }

  function pendingFormulaDecisions(postId = editingId) {
    return (serverContent.formulaReferenceDecisions || []).filter(
      (decision) => decision.status === "pending" && decision.postId === postId
    );
  }

  function formulaDecisionEventLabel(decision) {
    return decision.eventType === "card_archive" ? "公式卡已归档" : "公式或 Markdown 已有新修订";
  }

  function formulaDecisionCloneForm(decision) {
    if (formulaDecisionCloneId !== decision.decisionId) return "";
    return `
      <div class="formula-decision-clone" data-formula-decision-clone-form="${escapeHtml(decision.decisionId)}">
        <strong>另建并只绑定当前文章</strong>
        <p>新卡不会替换其他文章。名称、模块和分类必须由作者明确填写。</p>
        <div class="formula-decision-clone-fields">
          <label>
            新公式名称 *
            <input name="displayName" maxlength="160" required />
          </label>
          <label>
            所属模块 *
            <input name="moduleKey" pattern="[a-z0-9-]+" placeholder="electronics-basics" required />
          </label>
          <label>
            自定义分类 *
            <input name="categoryPath" maxlength="240" placeholder="基础电路/电压关系" required />
          </label>
          <label>
            用途说明
            <input name="purpose" maxlength="500" />
          </label>
          <label class="formula-decision-wide">
            标签
            <textarea name="tags" rows="2" placeholder="module:electronics-basics&#10;unit:V"></textarea>
          </label>
          <label class="formula-decision-wide">
            新卡 LaTeX *
            <textarea name="latex" rows="4" required>${escapeHtml(decision.boundLatex || "")}</textarea>
          </label>
          <label class="formula-decision-wide">
            新卡 Markdown 推导
            <textarea name="markdownDerivation" rows="5">${escapeHtml(decision.boundMarkdownDerivation || "")}</textarea>
          </label>
        </div>
        <div class="formula-decision-actions">
          <button class="button secondary" type="button" data-formula-decision-cancel-clone="${escapeHtml(decision.decisionId)}">取消</button>
          <button class="button primary" type="button" data-formula-decision-submit-clone="${escapeHtml(decision.decisionId)}">创建新卡并绑定本文章</button>
        </div>
      </div>
    `;
  }

  function renderFormulaDecisions() {
    if (!formulaDecisionPanel || !formulaDecisionList) return;
    const decisions = editingType === "post" && editingId ? pendingFormulaDecisions(editingId) : [];
    formulaDecisionPanel.hidden = decisions.length === 0;
    if (articleFormulaHelperPanel) articleFormulaHelperPanel.hidden = getType() !== "post" || decisions.length === 0;
    if (formulaDecisionCount) formulaDecisionCount.textContent = `${decisions.length} 项`;
    const currentPost = serverContent.posts.find((post) => post.id === editingId);
    const articlePublished = currentPost?.publishStatus === "published";
    formulaDecisionList.innerHTML = decisions
      .map((decision) => {
        const targetPublished =
          decision.eventType === "card_archive" || decision.targetRevisionId === decision.publishedRevisionId;
        return `
          <article class="formula-decision-card" data-formula-decision-id="${escapeHtml(decision.decisionId)}">
            <div class="formula-decision-heading">
              <div>
                <span class="formula-decision-badge">${escapeHtml(formulaDecisionEventLabel(decision))}</span>
                <strong>${escapeHtml(decision.formulaDisplayName || decision.formulaId)}</strong>
              </div>
              <code>${escapeHtml(decision.bindingId)}</code>
            </div>
            <p>当前文章继续显示修订 #${Number(decision.boundRevisionSequence || 0)}；${decision.archiveState === "archived" ? "公式卡当前为已归档状态。" : `可逐篇决定是否采用修订 #${Number(decision.targetRevisionSequence || 0)}。`}</p>
            ${
              articlePublished && !targetPublished
                ? '<p class="formula-decision-publication-warning">目标修订尚未发布。请先发布公式卡，或先把文章保存为草稿。</p>'
                : ""
            }
            <div class="formula-decision-comparison">
              <div class="formula-decision-version">
                <strong>文章当前版本</strong>
                ${formulaLatexHtml(decision.boundLatex)}
                <details><summary>Markdown 推导</summary><div class="markdown-article">${renderMarkdown(
                  decision.boundMarkdownDerivation || ""
                )}</div></details>
              </div>
              <div class="formula-decision-version">
                <strong>${decision.archiveState === "archived" ? "归档时版本" : "待采用版本"}</strong>
                ${formulaLatexHtml(decision.targetLatex)}
                <details><summary>Markdown 推导</summary><div class="markdown-article">${renderMarkdown(
                  decision.targetMarkdownDerivation || ""
                )}</div></details>
              </div>
            </div>
            <div class="formula-decision-actions">
              <button class="button secondary" type="button" data-formula-decision-action="keep" data-decision-id="${escapeHtml(decision.decisionId)}">保留文章原公式</button>
              <button class="button secondary" type="button" data-formula-decision-action="adopt" data-decision-id="${escapeHtml(
                decision.decisionId
              )}" ${articlePublished && !targetPublished ? 'disabled title="目标修订发布后才可用于已发布文章"' : ""}>采用当前修订</button>
              <button class="button primary" type="button" data-formula-decision-action="clone" data-decision-id="${escapeHtml(
                decision.decisionId
              )}" ${articlePublished ? 'disabled title="另建卡默认为草稿，请先把文章保存为草稿"' : ""}>另建公式卡</button>
            </div>
            ${formulaDecisionCloneForm(decision)}
          </article>
        `;
      })
      .join("");
  }

  async function resolveFormulaDecision(decisionId, action, formula = null) {
    if (isDirty) throw new Error("当前文章有未保存修改，请先保存或撤销后再处理公式版本");
    const result = await request(`/api/admin/formula-decisions/${encodeURIComponent(decisionId)}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, ...(formula ? { formula } : {}) })
    });
    serverContent = {
      ...serverContent,
      posts: result.posts || serverContent.posts,
      formulaReferenceDecisions: result.decisions || []
    };
    formulaDecisionCloneId = "";
    const current = editingId ? serverContent.posts.find((post) => post.id === editingId) : null;
    if (current) applyItemToForm("post", current, { confirm: false });
    renderFormulaDecisions();
    renderList();
    renderRecentContent();
    const actionLabel = action === "keep" ? "保留文章原公式" : action === "adopt" ? "采用最新版" : "另建公式卡并重新绑定";
    setNotice(`公式版本事项已逐篇处理：${actionLabel}。`, "success");
  }

  function cleanShortcodeLabel(value) {
    return String(value || "")
      .replace(/[|{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  function insertDeriveShortcode() {
    const slug = normalizedKnowledgeSlug(deriveLinkSlugInput?.value || "");
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) {
      setNotice("请输入合法的推导目标 slug，只能包含小写字母、数字和连字符。", "error");
      deriveLinkSlugInput?.focus();
      return;
    }
    const selected = selectedMarkdownText();
    const label = cleanShortcodeLabel(deriveLinkLabelInput?.value || selected || slug);
    if (!label) {
      setNotice("公式跳转标记 label 不能为空。", "error");
      deriveLinkLabelInput?.focus();
      return;
    }
    const color = knowledgeAccent(deriveLinkColorSelect?.value || contentForm.accentColor?.value || "purple");
    insertMarkdownText(`{{derive:${slug}|${label}|${color}}}`);
    setNotice(`已插入公式跳转标记：${slug}。`, "success");
  }

  function boostTemplateBySlug(slug) {
    return boostTemplates.find((template) => template.slug === slug) || boostTemplates[0];
  }

  function boostChainMarkdown() {
    return [
      "## BOOST 电感选型计算书公式推导入口",
      "",
      "{{derive:boost-duty-cycle-ccm|BOOST拓扑占空比推导（CCM）|purple}}",
      "{{derive:boost-inductor-current-rating|BOOST电感电流等级推导（CCM）|amber}}",
      "{{derive:boost-inductor-value|BOOST电感量下限推导|green}}",
      "{{derive:boost-inductor-ripple|BOOST电感纹波电流推导（CCM）|blue}}"
    ].join("\n");
  }

  function applyBoostTemplate() {
    const template = boostTemplateBySlug(boostTemplateSelect?.value);
    if (!template) return;
    if (snapshotHasContent(currentSnapshot()) && !confirmDiscard("套用 BOOST 示例节点会覆盖当前表单，确认继续吗？")) return;
    applySnapshotToForm(
      {
        editingType: null,
        editingId: null,
        type: "knowledge_node",
        slug: template.slug,
        nodeType: "derivation",
        symbol: template.symbol,
        title: template.title,
        excerpt: template.summary,
        tags: template.tags,
        markdown: template.markdown,
        publishStatus: "draft",
        visibilityStatus: "public",
        accentColor: template.accentColor,
        featured: false,
        featuredOrder: 0,
        recommendationPriority: 100,
        category: "模拟电子",
        statusKey: "planned",
        version: "",
        progress: 0,
        repoUrl: "",
        bomUrl: "",
        docsUrl: "",
        cover: ""
      },
      { dirty: true }
    );
    window.location.hash = "editor";
    contentForm.markdown.focus();
    setNotice(`已套用 BOOST 示例节点：${template.title}。`, "success");
  }

  function getType() {
    return new FormData(contentForm).get("type");
  }

  function categoryKey(category) {
    return {
      电子基础: "electronics-basics",
      电力电子: "power-electronics",
      模拟电子: "analog",
      STM32: "stm32",
      ESP32: "esp32",
      开源项目: "projects"
    }[category] || "analog";
  }

  function statusText(statusKey) {
    return { planned: "规划中", development: "开发中", online: "已上线" }[statusKey] || "规划中";
  }

  function isKnowledgeType(type) {
    return type === "knowledge_node";
  }

  function kindLabel(type) {
    if (type === "project") return "项目";
    if (isKnowledgeType(type)) return "推导节点";
    return "文章";
  }

  function publishLabel(status) {
    return { draft: "草稿", published: "已发布", archived: "已归档" }[status] || "草稿";
  }

  function visibilityLabel(status) {
    return { public: "公开列表", unlisted: "仅直链", private: "私有" }[status] || "公开列表";
  }

  function normalizedKnowledgeSlug(value) {
    return String(value || "").trim().toLowerCase();
  }

  function assertKnowledgeSlug(value) {
    const slug = normalizedKnowledgeSlug(value);
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) {
      throw new Error("推导节点 slug 只能包含小写字母、数字和连字符，长度 2-80");
    }
    return slug;
  }

  function knowledgeAccent(value) {
    return knowledgeColorTokens.includes(value) ? value : "purple";
  }

  function collectionKeyForType(type) {
    if (type === "project") return "projects";
    if (isKnowledgeType(type)) return "knowledgeNodes";
    return "posts";
  }

  function resultCollection(result, collectionKey) {
    if (collectionKey === "knowledgeNodes") return result.nodes || result.knowledgeNodes || [];
    return result[collectionKey] || [];
  }

  function adminSrc(src) {
    if (!src) return "";
    if (src.startsWith("data:") || src.startsWith("http")) return src;
    if (privateCmsBase && src.startsWith("/uploads/")) return `${privateCmsBase}${src}`;
    if (src.startsWith("./")) return `../${src.slice(2)}`;
    return src;
  }

  function fallbackCover(item) {
    if (item.cover) return item.cover;
    if (item.contentType === "knowledge_node") return "./assets/covers/analog-cover.png";
    if (item.contentType === "project") return "./assets/covers/project-cover.png";
    const key = categoryKey(item.category || "");
    if (key === "stm32") return "./assets/covers/stm32-cover.png";
    if (key === "esp32") return "./assets/covers/esp32-cover.png";
    if (key === "projects") return "./assets/covers/project-cover.png";
    return "./assets/covers/analog-cover.png";
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function itemKey(item) {
    return `${item.contentType}:${item.id}`;
  }

  function publishValue(item) {
    if (item.contentType === "project") return item.visibilityStatus;
    return item.publishStatus;
  }

  function featuredOrderValue(value) {
    const order = Number(value);
    if (!Number.isFinite(order)) return 0;
    return Math.min(featuredLimit - 1, Math.max(0, Math.trunc(order)));
  }

  function featuredSlotLabel(value) {
    return ["第一张", "第二张", "第三张", "第四张"][featuredOrderValue(value)] || "第一张";
  }

  function recommendationPriorityValue(value) {
    const priority = Number(value);
    if (!Number.isFinite(priority)) return 100;
    return Math.min(999, Math.max(1, Math.trunc(priority)));
  }

  function readingMinutesLabel(value) {
    const minutes = Number(value);
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 9999 ? `${minutes} 分钟阅读` : "";
  }

  function layoutOrderValue(value) {
    const order = Number(value);
    if (!Number.isFinite(order)) return 1;
    return Math.min(99, Math.max(1, Math.trunc(order)));
  }

  function layoutSizeValue(value) {
    return ["compact", "standard", "wide", "hero"].includes(value) ? value : "standard";
  }

  function layoutSizeLabel(value) {
    return { compact: "紧凑", standard: "标准", wide: "宽版", hero: "大块" }[layoutSizeValue(value)];
  }

  function layoutNextSize(value) {
    const sizes = ["compact", "standard", "wide", "hero"];
    const index = sizes.indexOf(layoutSizeValue(value));
    return sizes[(index + 1) % sizes.length];
  }

  function sortedLayoutSections(sections = []) {
    return sections
      .slice()
      .sort((a, b) => layoutOrderValue(a.order) - layoutOrderValue(b.order) || String(a.key).localeCompare(String(b.key)));
  }

  function featuredItems() {
    return (serverContent.carousel?.activeItems || [])
      .slice()
      .sort((a, b) => featuredOrderValue(a.slot ?? a.featuredOrder) - featuredOrderValue(b.slot ?? b.featuredOrder));
  }

  function visitorFocusCorpus(item) {
    return [
      item.categoryKey,
      item.category,
      item.title,
      item.excerpt,
      item.summary,
      item.tags,
      item.markdown,
      item.id,
      item.slug
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function matchesVisitorFocus(item) {
    if (item.contentType === "project" || item.type === "project") return true;
    if (item.contentType === "knowledge_node" || item.nodeType === "derivation") return true;
    const categoryKey = String(item.categoryKey || "").toLowerCase();
    const tags = String(item.tags || "").toLowerCase();
    if (["electronics-basics", "power-electronics", "projects", "derivations"].includes(categoryKey)) return true;
    if (["电子基础", "电力电子", "开源项目"].includes(String(item.category || ""))) return true;
    if (/(?:^|[\s,，、])module:(?:electronics-basics|power-electronics|projects|derivations)(?:$|[\s,，、])/.test(tags)) return true;
    if (String(item.tags || "").split(/[,，、]/).some((tag) => tag.trim().startsWith("公式"))) return true;
    return /\{\{(?:formula|derive):/.test(String(item.markdown || ""));
  }

  function visitorPublicState(item) {
    if (item.deletedAt) {
      return {
        code: "VISITOR_HIDDEN_DELETED",
        visible: false,
        label: "游客端已隐藏",
        message: "内容位于回收站。",
        recommendation: "建议取消轮播；如需展示，先恢复内容。"
      };
    }
    if (
      (item.contentType === "post" && item.publishStatus !== "published") ||
      (item.contentType === "project" && item.visibilityStatus !== "published")
    ) {
      return {
        code: "VISITOR_HIDDEN_UNPUBLISHED",
        visible: false,
        label: "游客端已隐藏",
        message: "内容尚未发布。",
        recommendation: "发布后可保留；暂不发布时建议取消轮播。"
      };
    }
    if (item.contentType === "project" && item.statusKey !== "online") {
      return {
        code: "VISITOR_HIDDEN_PROJECT_OFFLINE",
        visible: false,
        label: "游客端已隐藏",
        message: "项目状态不是“已上线”。",
        recommendation: "设为已上线后可保留；否则建议取消轮播。"
      };
    }
    if (serverContent.publicFocusMode?.enabled === true && !matchesVisitorFocus(item)) {
      return {
        code: "VISITOR_HIDDEN_FOCUS_SCOPE",
        visible: false,
        label: "游客端已隐藏",
        message: "内容不属于当前电力电子聚焦范围。",
        recommendation: "建议取消轮播；仅在内容确属电力电子时补充准确分类或标签。"
      };
    }
    return null;
  }

  function visitorFeaturedKeys() {
    const eligible = featuredItems()
      .filter((item) => !visitorPublicState(item))
      .filter((item) => !focusModeEnabled() || matchesVisitorFocus(item));
    return new Set(eligible.map(itemKey));
  }

  function visitorVisibility(item, visibleKeys) {
    const hidden = visitorPublicState(item);
    if (hidden) return hidden;
    if (!visibleKeys.has(itemKey(item))) {
      return {
        code: "VISITOR_HIDDEN_LIMIT",
        visible: false,
        label: "游客端已隐藏",
        message: "轮播排序后超出游客端前 4 项。",
        recommendation: "调整槽位；无法进入前 4 项时建议取消轮播。"
      };
    }
    return {
      code: "VISITOR_VISIBLE",
      visible: true,
      label: "游客端可见",
      message: serverContent.publicFocusMode?.enabled === true ? "已发布并符合当前聚焦范围。" : "已发布并进入游客端轮播。",
      recommendation: ""
    };
  }

  function searchableText(item) {
    return [
      item.title,
      item.excerpt,
      item.summary,
      item.category,
      item.status,
      item.symbol,
      item.nodeType,
      item.accentColor,
      item.visibilityStatus,
      item.license,
      item.tags,
      item.date,
      item.id,
      item.slug
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function setFieldVisible(field, visible) {
    if (!field) return;
    field.hidden = !visible;
    field.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = !visible;
    });
  }

  function updatePublishStatusOptions(type = getType()) {
    const archivedOption = contentForm.publishStatus.querySelector("[data-knowledge-only]");
    if (!archivedOption) return;
    archivedOption.hidden = !isKnowledgeType(type);
    archivedOption.disabled = !isKnowledgeType(type);
    if (!isKnowledgeType(type) && contentForm.publishStatus.value === "archived") {
      contentForm.publishStatus.value = "draft";
    }
  }

  function updateTypeFields() {
    const type = getType();
    const isProject = type === "project";
    const isKnowledge = isKnowledgeType(type);
    setFieldVisible(categoryField, !isProject && !isKnowledge);
    setFieldVisible(recommendationPriorityField, !isProject && !isKnowledge);
    setFieldVisible(readingMinutesField, type === "post");
    setFieldVisible(statusField, isProject);
    setFieldVisible(projectExtra, isProject);
    setFieldVisible(knowledgeSlugField, isKnowledge);
    setFieldVisible(knowledgeSymbolField, isKnowledge);
    setFieldVisible(knowledgeAccentField, isKnowledge);
    setFieldVisible(knowledgeVisibilityField, isKnowledge);
    setFieldVisible(featuredField, !isKnowledge);
    setFieldVisible(articleFormulaHelperPanel, type === "post");
    setFieldVisible(formulaHelperPanel, isKnowledge);
    if (isKnowledge) {
      if (!knowledgeColorTokens.includes(contentForm.accentColor?.value)) contentForm.accentColor.value = "purple";
      if (!["public", "unlisted", "private"].includes(contentForm.visibilityStatus?.value)) contentForm.visibilityStatus.value = "public";
    }
    if (contentForm.title) {
      contentForm.title.placeholder = isKnowledge ? "例如：Boost 占空比推导" : "例如：STM32 ADC + DMA 连续采样";
    }
    if (contentForm.excerpt) {
      contentForm.excerpt.placeholder = isKnowledge ? "推导页摘要。发布前摘要不能为空。" : "这段内容会显示在首页卡片和详情页顶部。";
    }
    updatePublishStatusOptions(type);
    if (!isKnowledge) {
      setKnowledgeWarnings([]);
      renderKnowledgeRevisions([], null);
    }
    renderFormulaDecisions();
    syncFormulaDrawerAvailability();
    syncFocusAuthoringControls();
    updateCoverCoordinateActions();
    updateVisibilityHint();
  }

  function updatePreview() {
    preview.innerHTML = renderMarkdown(contentForm.markdown.value);
  }

  function visibilityMessage(snapshot = currentSnapshot()) {
    const isProject = snapshot.type === "project";
    const isKnowledge = isKnowledgeType(snapshot.type);
    const isPublished = snapshot.publishStatus === "published";
    if (isKnowledge) {
      if (snapshot.publishStatus === "archived") {
        return { tone: "warning", text: "已归档的推导节点不会进入公开列表，公开直链也会隐藏。" };
      }
      if (!isPublished) {
        return { tone: "warning", text: "草稿推导节点只在 CMS 可见；可以先保存再补全摘要、正文和短码。" };
      }
      if (snapshot.visibilityStatus === "private") {
        return { tone: "warning", text: "私有推导节点即使已发布也不会进入公开列表或公开直链。" };
      }
      if (snapshot.visibilityStatus === "unlisted") {
        return { tone: "success", text: "已发布且仅直链可访问；不会出现在公开推导节点列表。" };
      }
      return { tone: "success", text: "已发布且公开；会进入公开推导节点列表，并可通过公式推导页访问。" };
    }
    if (!isPublished) {
      return { tone: "warning", text: "草稿不会进入访客端、RSS 或 sitemap；当前预览仅用于编辑校对。" };
    }
    if (isProject && snapshot.statusKey !== "online") {
      return { tone: "warning", text: "规划中或开发中的项目保存后不会公开正文；访客直链只显示“尚未上线”提示。" };
    }
    if (snapshot.featured) {
      return { tone: "success", text: `保存后将公开展示，并进入首页轮播${featuredSlotLabel(snapshot.featuredOrder)}。` };
    }
    return { tone: "success", text: "保存后将作为公开内容展示；如需进入首页首屏，请选择对应的轮播位置。" };
  }

  function updateVisibilityHint() {
    if (!visibilityHint) return;
    const message = visibilityMessage();
    visibilityHint.textContent = message.text;
    visibilityHint.classList.toggle("is-warning", message.tone === "warning");
    visibilityHint.classList.toggle("is-success", message.tone === "success");
  }

  function setKnowledgeWarnings(warnings = []) {
    if (!knowledgeWarnings) return;
    const visibleWarnings = [...new Set((warnings || []).filter(Boolean))];
    knowledgeWarnings.hidden = visibleWarnings.length === 0;
    knowledgeWarnings.innerHTML = visibleWarnings.length
      ? `
        <strong>保存警告</strong>
        <ul>${visibleWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
      `
      : "";
  }

  function revisionReasonLabel(reason) {
    return {
      save: "保存前快照",
      publish: "发布前快照",
      unpublish: "取消发布前快照",
      archive: "归档前快照",
      soft_delete: "回收前快照",
      restore: "恢复前快照",
      before_revision_restore: "版本恢复前快照"
    }[reason] || reason || "快照";
  }

  function renderKnowledgeRevisions(revisions = [], node = null) {
    if (!knowledgeRevisionsPanel || !knowledgeRevisionList) return;
    const showPanel = isKnowledgeType(getType()) || Boolean(node);
    knowledgeRevisionsPanel.hidden = !showPanel;
    if (!showPanel) return;
    if (!node?.id) {
      knowledgeRevisionList.innerHTML = `<div class="empty-state">保存推导节点后会显示版本记录。</div>`;
      return;
    }
    knowledgeRevisionList.innerHTML =
      revisions
        .map((revision) => {
          const snapshot = revision.snapshot?.node || revision.snapshot || {};
          const title = snapshot.title || revision.nodeTitle || "未命名推导节点";
          return `
            <article class="knowledge-revision-row">
              <div>
                <strong>${escapeHtml(revisionReasonLabel(revision.revisionReason))}</strong>
                <p>${escapeHtml(title)} / ${escapeHtml(revision.sourceUpdatedAt || revision.createdAt || "")}</p>
              </div>
              <button class="button secondary" data-action="restore-knowledge-revision" data-node-id="${escapeHtml(node.id)}" data-revision-id="${escapeHtml(revision.id)}" type="button">恢复此版本</button>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">暂无版本记录。保存或改变发布状态后会生成快照。</div>`;
  }

  async function refreshKnowledgeRevisions() {
    if (!editingId || !isKnowledgeType(editingType)) {
      renderKnowledgeRevisions([], null);
      setNotice("请先打开一个已保存的推导节点。", "warning");
      return;
    }
    const result = await request(`/api/admin/knowledge-nodes/${encodeURIComponent(editingId)}/revisions`);
    renderKnowledgeRevisions(result.revisions || [], result.node);
  }

  function currentSnapshot() {
    const data = new FormData(contentForm);
    return {
      editingType,
      editingId,
      cover: currentCover,
      coverCrop: currentCoverCrop ? { ...currentCoverCrop } : null,
      type: data.get("type") || "post",
      slug: data.get("slug") || "",
      nodeType: data.get("nodeType") || "derivation",
      symbol: data.get("symbol") || "",
      title: data.get("title") || "",
      category: data.get("category") || "模拟电子",
      statusKey: data.get("statusKey") || "planned",
      excerpt: data.get("excerpt") || "",
      tags: data.get("tags") || "",
      publishStatus: data.get("publishStatus") || "draft",
      visibilityStatus: data.get("visibilityStatus") || "public",
      accentColor: data.get("accentColor") || "purple",
      featured: data.get("featured") === "on",
      featuredOrder: String(featuredOrderValue(data.get("featuredOrder") || "0")),
      recommendationPriority: String(recommendationPriorityValue(data.get("recommendationPriority") || "100")),
      readingMinutes: data.get("readingMinutes") || "",
      version: data.get("version") || "",
      progress: data.get("progress") || "0",
      repoUrl: data.get("repoUrl") || "",
      bomUrl: data.get("bomUrl") || "",
      docsUrl: data.get("docsUrl") || "",
      markdown: data.get("markdown") || ""
    };
  }

  function snapshotHasContent(snapshot) {
    return Boolean(
      snapshot.title.trim() ||
        snapshot.slug.trim() ||
        snapshot.symbol.trim() ||
        snapshot.excerpt.trim() ||
        snapshot.tags.trim() ||
        snapshot.markdown.trim() ||
        snapshot.cover ||
        snapshot.version.trim() ||
        snapshot.repoUrl.trim() ||
        snapshot.bomUrl.trim() ||
        snapshot.docsUrl.trim() ||
        String(snapshot.readingMinutes || "").trim()
    );
  }

  function updateDraftStatus() {
    const draft = readDraft();
    draftStatus.hidden = !draft;
    if (!draft) return;
    const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : "刚刚";
    const title = draft.snapshot?.title ? `《${draft.snapshot.title}》` : "未命名内容";
    draftStatusText.textContent = `${title} 已自动保存在此浏览器，保存时间：${savedAt}。`;
  }

  function markDirty(value = true) {
    if (isRestoringForm) return;
    const wasDirty = isDirty;
    isDirty = value;
    if (isDirty) {
      queueDraftSave();
      if (!wasDirty) {
        setNotice("当前有未保存修改，本地草稿会自动保存在此浏览器。", "warning", {
          key: "article-dirty"
        });
      }
    }
    syncArticlePublishDock();
  }

  function markClean() {
    isDirty = false;
    dismissToast("article-dirty");
    syncArticlePublishDock();
  }

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  }

  function saveDraft() {
    const snapshot = currentSnapshot();
    if (!snapshotHasContent(snapshot)) {
      clearDraft();
      return;
    }
    lastDraftSavedAt = new Date().toISOString();
    localStorage.setItem(draftKey, JSON.stringify({ savedAt: lastDraftSavedAt, snapshot }));
    updateDraftStatus();
  }

  function queueDraftSave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(saveDraft, autosaveDelay);
  }

  function clearDraft() {
    localStorage.removeItem(draftKey);
    updateDraftStatus();
  }

  function confirmDiscard(message = "当前有未保存修改，确认继续吗？") {
    if (!isDirty) return true;
    return window.confirm(message);
  }

  function normalizedCoverCrop(value) {
    if (!value || typeof value !== "object") return null;
    const crop = {
      x: Number(value.x),
      y: Number(value.y),
      width: Number(value.width),
      height: Number(value.height),
      sourceWidth: Number(value.sourceWidth),
      sourceHeight: Number(value.sourceHeight)
    };
    if (
      Object.values(crop).some((number) => !Number.isFinite(number)) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.width <= 0 ||
      crop.height <= 0 ||
      crop.x + crop.width > 1.000000001 ||
      crop.y + crop.height > 1.000000001 ||
      !Number.isInteger(crop.sourceWidth) ||
      !Number.isInteger(crop.sourceHeight) ||
      crop.sourceWidth < 1 ||
      crop.sourceHeight < 1
    ) {
      return null;
    }
    const pixelWidth = crop.width * crop.sourceWidth;
    const expectedWidth = crop.height * crop.sourceHeight * 16 / 9;
    return Math.abs(pixelWidth - expectedWidth) <= Math.max(1, expectedWidth * 0.001) ? crop : null;
  }

  function updateCoverCoordinateActions() {
    if (!coverCoordinateActions) return;
    const visible = getType() === "post" && Boolean(currentCover);
    coverCoordinateActions.hidden = !visible;
    if (coverCropEdit) coverCropEdit.disabled = !visible;
    if (coverCropReset) coverCropReset.disabled = !visible || !currentCoverCrop;
  }

  function positionCoverPreview() {
    if (!coverPreviewShell || !coverPreview || coverPreviewShell.hidden || !currentCover) return;
    const crop = normalizedCoverCrop(currentCoverCrop);
    if (!crop) {
      Object.assign(coverPreview.style, {
        width: "100%",
        height: "100%",
        left: "0px",
        top: "0px",
        objectFit: "contain"
      });
      return;
    }
    const shellWidth = coverPreviewShell.clientWidth;
    const shellHeight = coverPreviewShell.clientHeight;
    if (!shellWidth || !shellHeight) return;
    const scale = Math.max(
      shellWidth / (crop.width * crop.sourceWidth),
      shellHeight / (crop.height * crop.sourceHeight)
    );
    const renderedWidth = crop.sourceWidth * scale;
    const renderedHeight = crop.sourceHeight * scale;
    Object.assign(coverPreview.style, {
      width: `${renderedWidth}px`,
      height: `${renderedHeight}px`,
      left: `${(shellWidth - crop.width * crop.sourceWidth * scale) / 2 - crop.x * crop.sourceWidth * scale}px`,
      top: `${(shellHeight - crop.height * crop.sourceHeight * scale) / 2 - crop.y * crop.sourceHeight * scale}px`,
      objectFit: "fill"
    });
  }

  function setCover(cover, label, options = {}) {
    const { dirty = true } = options;
    currentCover = cover || "";
    if (Object.prototype.hasOwnProperty.call(options, "crop")) {
      currentCoverCrop = normalizedCoverCrop(options.crop);
    } else {
      currentCoverCrop = null;
    }
    if (currentCover) {
      coverPreviewShell.hidden = false;
      coverPreview.src = adminSrc(currentCover);
      coverHint.textContent = label || (currentCoverCrop ? "已保存 16:9 取景坐标" : "显示完整原图");
      if (coverPreview.complete) requestAnimationFrame(positionCoverPreview);
    } else {
      coverPreviewShell.hidden = true;
      coverPreview.removeAttribute("src");
      coverHint.textContent = "从资源管理器选择图片，推荐 1600x900 或 1920x1080";
    }
    updateCoverCoordinateActions();
    if (dirty) markDirty();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("图片读取失败")));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", () => reject(new Error("图片解析失败，请换一张常见格式图片。")));
      image.src = source;
    });
  }

  function defaultCoverCrop(sourceWidth, sourceHeight) {
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = 16 / 9;
    if (sourceAspect >= targetAspect) {
      const width = targetAspect / sourceAspect;
      return { x: (1 - width) / 2, y: 0, width, height: 1, sourceWidth, sourceHeight };
    }
    const height = sourceAspect / targetAspect;
    return { x: 0, y: (1 - height) / 2, width: 1, height, sourceWidth, sourceHeight };
  }

  function layoutCoverCropSurface() {
    if (!cropState || !coverCropSurface) return;
    const maxWidth = Math.max(240, Math.min(980, window.innerWidth - 96));
    const maxHeight = Math.max(190, Math.min(620, window.innerHeight * 0.58));
    const scale = Math.min(maxWidth / cropState.sourceWidth, maxHeight / cropState.sourceHeight);
    coverCropSurface.style.width = `${cropState.sourceWidth * scale}px`;
    coverCropSurface.style.height = `${cropState.sourceHeight * scale}px`;
    renderCoverCrop();
  }

  function renderCoverCrop() {
    if (!cropState || !coverCropSelection || !coverCropSurface) return;
    const crop = cropState.crop;
    const surfaceWidth = coverCropSurface.clientWidth;
    const surfaceHeight = coverCropSurface.clientHeight;
    Object.assign(coverCropSelection.style, {
      left: `${crop.x * 100}%`,
      top: `${crop.y * 100}%`,
      width: `${crop.width * 100}%`,
      height: `${crop.height * 100}%`
    });
    Object.assign(coverCropClearImage.style, {
      width: `${surfaceWidth}px`,
      height: `${surfaceHeight}px`,
      left: `${-crop.x * surfaceWidth}px`,
      top: `${-crop.y * surfaceHeight}px`
    });
    const pixelWidth = Math.round(crop.width * crop.sourceWidth);
    const pixelHeight = Math.round(crop.height * crop.sourceHeight);
    coverCropStatus.textContent = `${pixelWidth} × ${pixelHeight} px / 16:9`;
    coverCropSelection.setAttribute(
      "aria-label",
      `16:9 封面取景框，起点 ${Math.round(crop.x * 100)}%、${Math.round(crop.y * 100)}%，尺寸 ${Math.round(crop.width * 100)}% × ${Math.round(crop.height * 100)}%`
    );
  }

  async function openCoverCrop({ file = null, cover = "", crop = null } = {}) {
    const source = file ? await readFileAsDataUrl(file) : adminSrc(cover);
    const image = await loadImage(source);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const savedCrop = normalizedCoverCrop(crop);
    cropState = {
      file,
      pendingCover: cover,
      source,
      sourceWidth,
      sourceHeight,
      crop:
        savedCrop && savedCrop.sourceWidth === sourceWidth && savedCrop.sourceHeight === sourceHeight
          ? { ...savedCrop }
          : defaultCoverCrop(sourceWidth, sourceHeight),
      returnFocus: document.activeElement
    };
    coverCropMutedImage.src = source;
    coverCropClearImage.src = source;
    coverCropModal.hidden = false;
    requestAnimationFrame(() => {
      layoutCoverCropSurface();
      coverCropSelection.focus();
    });
  }

  function closeCoverCrop() {
    coverCropModal.hidden = true;
    const returnFocus = cropState?.returnFocus;
    cropState = null;
    cropPointerState = null;
    coverFile.value = "";
    if (returnFocus?.focus) returnFocus.focus();
  }

  async function uploadOriginalCover(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await request("/api/uploads", {
      method: "POST",
      body: JSON.stringify({ filename: file.name || "cover-image", dataUrl })
    });
    renderImageLibrary(result.uploads || []);
    return result;
  }

  async function applyCoverCrop() {
    if (!cropState) return;
    const crop = { ...cropState.crop };
    let cover = cropState.pendingCover;
    let label = "已更新 16:9 取景坐标";
    if (cropState.file) {
      const result = await uploadOriginalCover(cropState.file);
      cover = result.url;
      label = `${cropState.file.name} 原图已上传，取景坐标待保存`;
    }
    setCover(cover, label, { crop });
    setNotice("已保留原图并更新封面取景坐标，请保存内容写入数据库。", "success");
    closeCoverCrop();
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function movedCoverCrop(start, deltaX, deltaY) {
    return {
      ...start,
      x: clamp(start.x + deltaX, 0, 1 - start.width),
      y: clamp(start.y + deltaY, 0, 1 - start.height)
    };
  }

  function resizedCoverCrop(start, corner, desiredWidth) {
    const factor = start.sourceWidth / start.sourceHeight * 9 / 16;
    const movesRight = corner.endsWith("e");
    const movesDown = corner.startsWith("s");
    const anchorX = movesRight ? start.x : start.x + start.width;
    const anchorY = movesDown ? start.y : start.y + start.height;
    const maxHorizontal = movesRight ? 1 - anchorX : anchorX;
    const maxVertical = (movesDown ? 1 - anchorY : anchorY) / factor;
    const maximumWidth = Math.max(0.000001, Math.min(maxHorizontal, maxVertical));
    const minimumWidth = Math.min(maximumWidth, Math.max(16 / start.sourceWidth, 0.04));
    const width = clamp(desiredWidth, minimumWidth, maximumWidth);
    const height = width * factor;
    return {
      ...start,
      x: movesRight ? anchorX : anchorX - width,
      y: movesDown ? anchorY : anchorY - height,
      width,
      height
    };
  }

  function cropPointerDown(event) {
    if (!cropState || event.button > 0) return;
    const handle = event.target.closest("[data-crop-corner]");
    cropPointerState = {
      pointerId: event.pointerId,
      target: event.target,
      mode: handle ? "resize" : "move",
      corner: handle?.dataset.cropCorner || "",
      startX: event.clientX,
      startY: event.clientY,
      crop: { ...cropState.crop }
    };
    event.target.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function cropPointerMove(event) {
    if (!cropState || !cropPointerState || event.pointerId !== cropPointerState.pointerId) return;
    const rect = coverCropSurface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const deltaX = (event.clientX - cropPointerState.startX) / rect.width;
    const deltaY = (event.clientY - cropPointerState.startY) / rect.height;
    if (cropPointerState.mode === "move") {
      cropState.crop = movedCoverCrop(cropPointerState.crop, deltaX, deltaY);
    } else {
      const horizontalWidth = cropPointerState.crop.width + (cropPointerState.corner.endsWith("e") ? deltaX : -deltaX);
      const factor = cropPointerState.crop.sourceWidth / cropPointerState.crop.sourceHeight * 9 / 16;
      const verticalWidth = cropPointerState.crop.width + (cropPointerState.corner.startsWith("s") ? deltaY : -deltaY) / factor;
      const useHorizontal = Math.abs(deltaX) >= Math.abs(deltaY / factor);
      cropState.crop = resizedCoverCrop(
        cropPointerState.crop,
        cropPointerState.corner,
        useHorizontal ? horizontalWidth : verticalWidth
      );
    }
    renderCoverCrop();
    event.preventDefault();
  }

  function cropPointerEnd(event) {
    if (!cropPointerState || event.pointerId !== cropPointerState.pointerId) return;
    cropPointerState.target?.releasePointerCapture?.(event.pointerId);
    cropPointerState = null;
  }

  function cropKeyboardMove(event) {
    if (!cropState || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const multiplier = event.shiftKey ? 10 : 1;
    const handle = event.target.closest("[data-crop-corner]");
    if (handle) {
      const corner = handle.dataset.cropCorner;
      const factor = cropState.crop.sourceWidth / cropState.crop.sourceHeight * 9 / 16;
      const horizontalDirection =
        event.key === "ArrowLeft"
          ? -1
          : event.key === "ArrowRight"
            ? 1
            : 0;
      const verticalDirection =
        event.key === "ArrowUp"
          ? -1
          : event.key === "ArrowDown"
            ? 1
            : 0;
      const widthDelta = horizontalDirection
        ? horizontalDirection * (corner.endsWith("e") ? 1 : -1) * multiplier / cropState.sourceWidth
        : verticalDirection * (corner.startsWith("s") ? 1 : -1) * multiplier / cropState.sourceHeight / factor;
      cropState.crop = resizedCoverCrop(
        cropState.crop,
        corner,
        cropState.crop.width + widthDelta
      );
    } else {
      const deltaX =
        event.key === "ArrowLeft"
          ? -multiplier / cropState.sourceWidth
          : event.key === "ArrowRight"
            ? multiplier / cropState.sourceWidth
            : 0;
      const deltaY =
        event.key === "ArrowUp"
          ? -multiplier / cropState.sourceHeight
          : event.key === "ArrowDown"
            ? multiplier / cropState.sourceHeight
            : 0;
      cropState.crop = movedCoverCrop(cropState.crop, deltaX, deltaY);
    }
    renderCoverCrop();
    event.preventDefault();
  }

  function resetForm(options = {}) {
    const { dirty = false, clearLocalDraft = false } = options;
    isRestoringForm = true;
    editingType = null;
    editingId = null;
    contentForm.reset();
    contentForm.type.value = "post";
    if (contentForm.nodeType) contentForm.nodeType.value = "derivation";
    if (contentForm.slug) contentForm.slug.value = "";
    if (contentForm.symbol) contentForm.symbol.value = "";
    if (contentForm.accentColor) contentForm.accentColor.value = "purple";
    if (contentForm.visibilityStatus) contentForm.visibilityStatus.value = "public";
    contentForm.publishStatus.value = "draft";
    contentForm.featuredOrder.value = "0";
    contentForm.recommendationPriority.value = "100";
    setCover("", "", { dirty: false });
    setKnowledgeWarnings([]);
    renderKnowledgeRevisions([], null);
    updateTypeFields();
    updatePreview();
    updateVisibilityHint();
    isRestoringForm = false;
    if (clearLocalDraft) clearDraft();
    dirty ? markDirty() : markClean();
  }

  function startNewKnowledgeNode() {
    if (!confirmDiscard("当前编辑器里有未保存修改，新建推导节点会覆盖表单，确认继续吗？")) return;
    isRestoringForm = true;
    editingType = null;
    editingId = null;
    contentForm.reset();
    contentForm.type.value = "knowledge_node";
    if (contentForm.nodeType) contentForm.nodeType.value = "derivation";
    if (contentForm.publishStatus) contentForm.publishStatus.value = "draft";
    if (contentForm.visibilityStatus) contentForm.visibilityStatus.value = "public";
    if (contentForm.accentColor) contentForm.accentColor.value = "purple";
    setCover("", "", { dirty: false });
    setKnowledgeWarnings([]);
    renderKnowledgeRevisions([], { id: "" });
    updateTypeFields();
    updatePreview();
    updateVisibilityHint();
    isRestoringForm = false;
    markClean();
    window.location.hash = "editor";
    contentForm.slug?.focus();
    setNotice("已切换到新建推导节点。请填写 slug、变量符号、标题和正文。", "info");
  }

  function combinedItems() {
    return [
      ...serverContent.posts.map((item) => ({ ...item, contentType: "post" })),
      ...serverContent.projects.map((item) => ({ ...item, contentType: "project" })),
      ...(serverContent.knowledgeNodes || []).map((item) => ({ ...item, contentType: "knowledge_node" }))
    ];
  }

  function filteredItems() {
    const query = filters.search.trim().toLowerCase();
    return combinedItems().filter((item) => {
      if (filters.type !== "all" && item.contentType !== filters.type) return false;
      if (filters.status === "published" && (item.deletedAt || publishValue(item) !== "published")) return false;
      if (filters.status === "draft" && (item.deletedAt || publishValue(item) === "published")) return false;
      if (filters.status === "archived" && (item.deletedAt || publishValue(item) !== "archived")) return false;
      if (filters.status === "deleted" && !item.deletedAt) return false;
      if (filters.status === "featured" && !item.featured) return false;
      if (query && !searchableText(item).includes(query)) return false;
      return true;
    });
  }

  function pruneSelection() {
    const keys = new Set(combinedItems().map(itemKey));
    [...selectedContent].forEach((key) => {
      if (!keys.has(key)) selectedContent.delete(key);
    });
  }

  function updateBulkState(items = filteredItems()) {
    pruneSelection();
    const visibleKeys = items.map(itemKey);
    const selectedVisible = visibleKeys.filter((key) => selectedContent.has(key));
    contentResultCount.textContent = `${items.length} 项内容`;
    selectedCount.textContent = `已选择 ${selectedContent.size} 项`;
    selectAllContent.checked = visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;
    selectAllContent.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleKeys.length;
    const hasSelection = selectedContent.size > 0;
    [bulkPublishButton, bulkDraftButton, bulkDeleteButton, bulkRestoreButton].forEach((button) => {
      button.disabled = !hasSelection;
    });
  }

  function itemTimestamp(item) {
    return Date.parse(item.updatedAt || item.createdAt || item.date || "") || 0;
  }

  function recentItems(limit = 4) {
    return combinedItems()
      .filter((item) => !item.deletedAt)
      .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
      .slice(0, limit);
  }

  function renderRecentContent() {
    if (!recentContentList) return;
    recentContentList.innerHTML =
      recentItems()
        .map((item) => {
          const kind = kindLabel(item.contentType);
          const publish = publishLabel(publishValue(item));
          const decisionCount = item.contentType === "post" ? pendingFormulaDecisions(item.id).length : 0;
          const meta = item.contentType === "project" ? item.status || "项目" : item.contentType === "knowledge_node" ? item.symbol || item.nodeType || "推导节点" : item.category || "文章";
          const cover = fallbackCover(item);
          return `
            <article class="admin-recommendation-card">
              <img src="${adminSrc(cover)}" alt="${escapeHtml(item.title || "未命名内容")}封面" />
              <div class="admin-recommendation-body">
                <span>${kind} / ${escapeHtml(publish)} / ${escapeHtml(meta)}</span>
                <strong>${escapeHtml(item.title || "未命名内容")}${decisionCount ? ` <span class="content-formula-decision">公式待决 ${decisionCount}</span>` : ""}</strong>
                <p>${escapeHtml(item.date || "暂无日期")}</p>
                <button class="button secondary" data-action="edit" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
              </div>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">暂无可推荐内容。</div>`;
  }

  function renderFeaturedSlots() {
    if (!featuredSlots) return;
    const byOrder = new Map();
    const visibleKeys = visitorFeaturedKeys();
    featuredItems().forEach((item) => {
      const order = featuredOrderValue(item.slot ?? item.featuredOrder);
      if (!byOrder.has(order)) byOrder.set(order, item);
    });
    const current = currentSnapshot();
    const canAssignCurrent = snapshotHasContent(current) && !isKnowledgeType(current.type);
    featuredSlots.innerHTML = Array.from({ length: featuredLimit }, (_, order) => {
      const item = byOrder.get(order);
      if (!item) {
        return `
          <article class="featured-slot is-empty" data-slot="${order}">
            <div class="featured-slot-head">
              <span>${featuredSlotLabel(order)}</span>
              <small>空槽位</small>
            </div>
            <div class="featured-slot-empty-mark">待安排</div>
            <button class="button secondary" data-action="assign-featured-slot" data-slot="${order}" type="button" ${canAssignCurrent ? "" : "disabled"}>填入当前内容</button>
          </article>
        `;
      }
      const kind = kindLabel(item.contentType);
      const publish = publishLabel(publishValue(item));
      const meta = item.contentType === "project" ? item.status || "项目" : item.category || "文章";
      const cover = fallbackCover(item);
      const visibility = visitorVisibility(item, visibleKeys);
      return `
        <article class="featured-slot is-filled ${visibility.visible ? "is-visitor-visible" : "is-visitor-hidden"}" data-slot="${order}" data-visitor-reason="${visibility.code}">
          <div class="featured-slot-head">
            <span>${featuredSlotLabel(order)}</span>
            <small>${kind} · ${escapeHtml(publish)}</small>
          </div>
          <img src="${adminSrc(cover)}" alt="${escapeHtml(item.title || "未命名内容")}封面" />
          <strong>${escapeHtml(item.title || "未命名内容")}</strong>
          <small>${escapeHtml(meta)}</small>
          <div class="visitor-visibility ${visibility.visible ? "is-visible" : "is-hidden"}" role="status">
            <strong>${visibility.label}</strong>
            <span>${escapeHtml(visibility.message)}</span>
            <code>${visibility.code}</code>
            ${visibility.recommendation ? `<p>${escapeHtml(visibility.recommendation)}</p>` : ""}
          </div>
          <div class="featured-slot-actions">
            <button class="button secondary" data-action="edit-featured" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
            <button class="button secondary danger ${visibility.visible ? "" : "is-recommended"}" data-action="clear-featured-slot" data-type="${item.contentType}" data-id="${item.id}" type="button">${visibility.visible ? "取消轮播" : "建议取消轮播"}</button>
          </div>
        </article>
      `;
    }).join("");
    renderCarouselConflictReport();
    renderCarouselBuffer();
  }

  function renderCarouselConflictReport() {
    if (!carouselConflictReport) return;
    const conflicts = serverContent.carousel?.conflicts || [];
    carouselConflictReport.innerHTML =
      conflicts
        .map(
          (item) => `
            <article class="carousel-conflict-row">
              <div>
                <strong>${Number.isInteger(Number(item.slot)) ? featuredSlotLabel(item.slot) : "越界槽位"}</strong>
                <span>${escapeHtml(item.contentType === "project" ? "项目" : "文章")} · ${escapeHtml(item.contentTitle || item.contentId)}</span>
              </div>
              <code>${escapeHtml(item.reasonCode)}</code>
              <small>${escapeHtml(item.contentType)}:${escapeHtml(item.contentId)} · ${escapeHtml(item.detectedAt || "")}</small>
            </article>
          `
        )
        .join("") || `<div class="empty-state">未检测到历史重复或越界槽位。</div>`;
  }

  function carouselReferenceLabel(status) {
    return {
      available: "关联正常",
      missing: "关联缺失",
      archived: "已归档 / 回收站"
    }[status] || "关联状态未知";
  }

  function renderCarouselBuffer() {
    if (!carouselBufferList) return;
    const buffered = serverContent.carousel?.buffered || [];
    const activeCount = featuredItems().length;
    const conflictCount = Number(serverContent.carousel?.summary?.conflictCount || 0);
    if (carouselManagerSummary) {
      carouselManagerSummary.textContent =
        `已配置槽位 ${activeCount}/${featuredLimit}，缓冲 ${buffered.length} 项，历史冲突 ${conflictCount} 项。`;
    }
    carouselBufferList.innerHTML =
      buffered
        .map((item) => {
          const broken = item.referenceStatus === "missing" || item.referenceStatus === "archived";
          const originalSlot = featuredOrderValue(item.originalSlot);
          const cover = item.displayImage || item.imageReference || "./assets/covers/analog-cover.png";
          const referenceLabel = carouselReferenceLabel(item.referenceStatus);
          return `
            <article class="carousel-buffer-card ${broken ? "is-broken" : ""}" data-buffer-id="${escapeHtml(item.bufferId)}">
              <img src="${adminSrc(cover)}" alt="${escapeHtml(item.displayTitle || item.contentTitle || "缓冲内容")}封面" />
              <div class="carousel-buffer-copy">
                <div class="carousel-buffer-meta">
                  <span>${item.contentType === "project" ? "项目" : "文章"}</span>
                  <span>原槽位 ${originalSlot}</span>
                  <span class="${broken ? "is-broken" : ""}">${escapeHtml(referenceLabel)}</span>
                  <span>${escapeHtml(publishLabel(item.currentPublishStatus || "draft"))}</span>
                </div>
                <strong>${escapeHtml(item.displayTitle || item.contentTitle || item.contentId)}</strong>
                <p>${escapeHtml(item.restoreMessage || "请选择空槽位后手动恢复。")}</p>
                <div class="carousel-buffer-codes">
                  <code>${escapeHtml(item.bufferedReason || "CAROUSEL_FOCUS_SCOPE_OUTSIDE")}</code>
                  <code>${escapeHtml(item.restoreReasonCode || "CAROUSEL_RESTORE_ALLOWED")}</code>
                </div>
                <small>身份 ${escapeHtml(`${item.contentType}:${item.contentId}`)} · 缓冲于 ${escapeHtml(item.bufferedAt || "未知时间")}</small>
              </div>
              <div class="carousel-buffer-actions">
                <label>
                  恢复槽位
                  <select data-carousel-restore-slot ${item.restoreAllowed ? "" : "disabled"}>
                    ${Array.from(
                      { length: featuredLimit },
                      (_, slot) => `<option value="${slot}" ${slot === originalSlot ? "selected" : ""}>槽位 ${slot}</option>`
                    ).join("")}
                  </select>
                </label>
                <button class="button primary" data-action="restore-carousel-buffer" type="button" ${
                  item.restoreAllowed ? "" : "disabled"
                }>手动恢复</button>
                ${
                  broken
                    ? `<button class="button secondary danger" data-action="remove-carousel-buffer" type="button">移除缓冲记录</button>`
                    : ""
                }
              </div>
            </article>
          `;
        })
        .join("") ||
      `<div class="empty-state">当前没有缓冲项。符合聚焦范围的轮播内容仍保留在上方活跃槽位。</div>`;
  }

  function currentSiteLayout() {
    const saved = serverContent.siteLayout || {};
    return Object.fromEntries(
      defaultLayoutPages.map((page) => {
        const savedRows = Array.isArray(saved[page.key]) ? saved[page.key] : [];
        const savedMap = new Map(savedRows.map((item) => [item.key, item]));
        return [
          page.key,
          page.sections.map((base) => {
            const item = savedMap.get(base.key) || {};
            return {
              ...base,
              order: Number(item.order || base.order),
              visible: item.visible !== false,
              size: layoutSizeValue(item.size || base.size),
              preview: base.preview || item.preview || "block"
            };
          })
        ];
      })
    );
  }

  function renderLayoutPanel() {
    if (!layoutPanel) return;
    const layout = currentSiteLayout();
    layoutPanel.innerHTML = `
      ${defaultLayoutPages
        .map((page) => {
          const sections = sortedLayoutSections(layout[page.key] || []);
          return `
            <section class="layout-page-group" data-layout-page-group="${page.key}">
              <div class="layout-page-head">
                <h3>${escapeHtml(page.label)}</h3>
                <span>拖动模块调整位置，点右下角调整大小</span>
              </div>
              <div class="layout-page-frame">
                <div class="layout-browser-bar"><span></span><span></span><span></span><strong>${escapeHtml(page.label)}</strong></div>
                <div class="layout-page-board" data-layout-page-board="${page.key}" aria-label="${escapeHtml(page.label)} 页面快照">
                ${sections
                  .map(
                    (section, index) => `
                      <article class="layout-snapshot-tile layout-preview-${escapeHtml(section.preview || "block")} size-${layoutSizeValue(section.size)} ${section.visible === false ? "is-hidden" : ""}" draggable="true" data-layout-page="${page.key}" data-layout-key="${section.key}" tabindex="0">
                        <div class="layout-tile-meta">
                          <span>${index + 1}</span>
                          <small>${section.visible === false ? "已隐藏" : layoutSizeLabel(section.size)}</small>
                        </div>
                        <strong>${escapeHtml(section.label)}</strong>
                        <button class="layout-resize-handle" data-layout-resize type="button" title="切换模块大小" aria-label="调整 ${escapeHtml(section.label)} 大小"></button>
                      </article>
                    `
                  )
                  .join("")}
                </div>
              </div>
              <div class="layout-page-fields">
                ${sections
                  .map(
                    (section) => `
                      <article class="layout-row" data-layout-page="${page.key}" data-layout-key="${section.key}">
                        <div>
                          <strong>${escapeHtml(section.label)}</strong>
                          <p>${escapeHtml(section.description || "")}</p>
                        </div>
                        <div class="layout-row-controls">
                          <label>
                            显示顺序
                            <input name="layoutOrder" type="number" min="1" max="99" step="1" value="${Number(section.order || 1)}" />
                          </label>
                          <label>
                            模块大小
                            <select name="layoutSize">
                              <option value="compact" ${layoutSizeValue(section.size) === "compact" ? "selected" : ""}>紧凑</option>
                              <option value="standard" ${layoutSizeValue(section.size) === "standard" ? "selected" : ""}>标准</option>
                              <option value="wide" ${layoutSizeValue(section.size) === "wide" ? "selected" : ""}>宽版</option>
                              <option value="hero" ${layoutSizeValue(section.size) === "hero" ? "selected" : ""}>大块</option>
                            </select>
                          </label>
                          <div class="layout-move-buttons" aria-label="调整 ${escapeHtml(section.label)} 顺序">
                            <button class="button secondary" data-layout-move="-1" type="button" title="向前移动">↑</button>
                            <button class="button secondary" data-layout-move="1" type="button" title="向后移动">↓</button>
                          </div>
                          <label class="checkbox-field">
                            <input name="layoutVisible" type="checkbox" ${section.visible !== false ? "checked" : ""} />
                            显示
                          </label>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `;
        })
        .join("")}
      <div class="layout-actions">
        <button class="button secondary" id="layoutResetButton" type="button">恢复默认排布</button>
        <button class="button primary" id="layoutSaveButton" type="button">保存排布</button>
      </div>
    `;
  }

  function readLayoutPanel() {
    const rows = [...layoutPanel.querySelectorAll(".layout-row[data-layout-key]")];
    return rows.reduce((result, row) => {
      const page = row.dataset.layoutPage || "home";
      if (!result[page]) result[page] = [];
      result[page].push({
        key: row.dataset.layoutKey,
        order: layoutOrderValue(row.querySelector("[name='layoutOrder']").value),
        visible: row.querySelector("[name='layoutVisible']").checked,
        size: layoutSizeValue(row.querySelector("[name='layoutSize']").value)
      });
      return result;
    }, {});
  }

  function writeLayoutPanel(layout) {
    Object.entries(layout).forEach(([, rows]) => {
      sortedLayoutSections(rows).forEach((row, index) => {
        row.order = index + 1;
      });
    });
    serverContent.siteLayout = layout;
    renderLayoutPanel();
  }

  function moveLayoutSection(pageKey, sectionKey, direction) {
    const layout = readLayoutPanel();
    const rows = sortedLayoutSections(layout[pageKey] || []);
    const from = rows.findIndex((row) => row.key === sectionKey);
    const to = from + Number(direction);
    if (from < 0 || to < 0 || to >= rows.length) return;
    const [moved] = rows.splice(from, 1);
    rows.splice(to, 0, moved);
    layout[pageKey] = rows;
    writeLayoutPanel(layout);
  }

  function reorderLayoutSection(pageKey, sectionKey, targetKey) {
    if (!pageKey || !sectionKey || !targetKey || sectionKey === targetKey) return;
    const layout = readLayoutPanel();
    const rows = sortedLayoutSections(layout[pageKey] || []);
    const from = rows.findIndex((row) => row.key === sectionKey);
    const to = rows.findIndex((row) => row.key === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = rows.splice(from, 1);
    rows.splice(to, 0, moved);
    layout[pageKey] = rows;
    writeLayoutPanel(layout);
  }

  function resizeLayoutSection(pageKey, sectionKey) {
    const layout = readLayoutPanel();
    const rows = layout[pageKey] || [];
    const row = rows.find((item) => item.key === sectionKey);
    if (!row) return;
    row.size = layoutNextSize(row.size);
    writeLayoutPanel(layout);
  }

  async function saveLayoutPanel(button) {
    if (!layoutPanel) return;
    await withBusy(button, "保存中...", async () => {
      const result = await request("/api/admin/site-layout", {
        method: "POST",
        body: JSON.stringify({ siteLayout: readLayoutPanel() })
      });
      serverContent.siteLayout = result.siteLayout;
      renderLayoutPanel();
      setNotice("游客端页面排布已保存，已打开的访客页面会自动同步新顺序。", "success");
    });
  }

  function renderList() {
    const items = filteredItems();
    updateBulkState(items);
    list.innerHTML =
      items
        .map((item) => {
          const kind = kindLabel(item.contentType);
          const publish = publishValue(item);
          const decisionCount = item.contentType === "post" ? pendingFormulaDecisions(item.id).length : 0;
          const meta =
            item.contentType === "project"
              ? `${item.status || ""} / ${item.license || ""}`
              : item.contentType === "knowledge_node"
                ? `${item.symbol || "未填变量"} / ${visibilityLabel(item.visibilityStatus)} / ${item.accentColor || "purple"}`
                : [item.category || "", readingMinutesLabel(item.readingMinutes)].filter(Boolean).join(" / ");
          const tags = item.tags ? ` / ${item.tags}` : "";
          const deleted = Boolean(item.deletedAt);
          const slot = item.featured && item.contentType !== "knowledge_node" ? ` / 轮播${featuredSlotLabel(item.featuredOrder)}` : "";
          const key = itemKey(item);
          const canHardDelete = item.contentType !== "knowledge_node";
          const quickStatusAction =
            item.contentType === "knowledge_node" && !deleted
              ? publish === "published"
                ? `<button class="button secondary" data-action="draft" data-type="${item.contentType}" data-id="${item.id}" type="button">转草稿</button>`
                : `<button class="button secondary" data-action="publish" data-type="${item.contentType}" data-id="${item.id}" type="button">发布</button>`
              : "";
          return `
            <article class="admin-row ${deleted ? "is-deleted" : ""}">
              <label class="admin-row-select" aria-label="选择 ${escapeHtml(item.title)}">
                <input data-action="select" data-key="${escapeHtml(key)}" type="checkbox" ${selectedContent.has(key) ? "checked" : ""} />
              </label>
              <img src="${adminSrc(fallbackCover(item))}" alt="${escapeHtml(item.title)}封面" />
              <div>
                <strong>
                  <span class="content-kind">${kind}</span>${escapeHtml(item.title)}
                  <span class="content-status">${deleted ? "回收站" : publishLabel(publish)}</span>
                  ${decisionCount ? `<span class="content-formula-decision">公式待决 ${decisionCount}</span>` : ""}
                </strong>
                <p>${escapeHtml(meta)}${escapeHtml(tags)} / ${escapeHtml(item.date || "暂无日期")}${escapeHtml(slot)}</p>
                <p>${escapeHtml(item.excerpt || item.summary)}</p>
              </div>
              <div class="row-actions">
                ${deleted ? `
                  <button class="button secondary" data-action="restore" data-type="${item.contentType}" data-id="${item.id}" type="button">恢复</button>
                  ${canHardDelete ? `<button class="button secondary" data-action="hard-delete" data-type="${item.contentType}" data-id="${item.id}" type="button">永久删除</button>` : ""}
                ` : `
                  <button class="button secondary" data-action="edit" data-type="${item.contentType}" data-id="${item.id}" type="button">编辑</button>
                  ${quickStatusAction}
                  <button class="button secondary" data-action="delete" data-type="${item.contentType}" data-id="${item.id}" type="button">移入回收站</button>
                `}
              </div>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">没有匹配的内容。</div>`;
    renderRecentContent();
    renderFeaturedSlots();
    renderKnowledgeNodeList();
  }

  function knowledgeItems() {
    return (serverContent.knowledgeNodes || []).map((item) => ({ ...item, contentType: "knowledge_node" }));
  }

  function renderKnowledgeNodeList() {
    if (!knowledgeNodeList) return;
    const nodes = knowledgeItems();
    knowledgeNodeList.innerHTML =
      nodes
        .map((node) => {
          const deleted = Boolean(node.deletedAt);
          const publish = publishValue(node);
          const links = Array.isArray(node.links) ? node.links : [];
          const dangling = links.filter((link) => link.resolved === false).length;
          return `
            <article class="admin-row knowledge-row ${deleted ? "is-deleted" : ""}">
              <span class="knowledge-color-dot knowledge-color-dot--${escapeHtml(node.accentColor || "purple")}" aria-hidden="true"></span>
              <img src="${adminSrc(fallbackCover(node))}" alt="${escapeHtml(node.title || "未命名推导节点")}封面" />
              <div>
                <strong>
                  <span class="content-kind">推导节点</span>${escapeHtml(node.title || "未命名推导节点")}
                  <span class="content-status">${deleted ? "回收站" : publishLabel(publish)}</span>
                </strong>
                <p>${escapeHtml(node.symbol || "未填变量")} / ${escapeHtml(node.slug || node.id)} / ${visibilityLabel(node.visibilityStatus)}</p>
                <p>${escapeHtml(node.summary || "暂无摘要")}${dangling ? ` / ${dangling} 个悬空推导目标` : ""}</p>
              </div>
              <div class="row-actions">
                ${deleted ? `
                  <button class="button secondary" data-action="restore" data-type="knowledge_node" data-id="${escapeHtml(node.id)}" type="button">恢复</button>
                ` : `
                  <button class="button secondary" data-action="edit" data-type="knowledge_node" data-id="${escapeHtml(node.id)}" type="button">编辑</button>
                  ${publish === "published"
                    ? `<button class="button secondary" data-action="draft" data-type="knowledge_node" data-id="${escapeHtml(node.id)}" type="button">转草稿</button>`
                    : `<button class="button secondary" data-action="publish" data-type="knowledge_node" data-id="${escapeHtml(node.id)}" type="button">发布</button>`}
                  <button class="button secondary" data-action="delete" data-type="knowledge_node" data-id="${escapeHtml(node.id)}" type="button">移入回收站</button>
                `}
              </div>
            </article>
          `;
        })
        .join("") || `<div class="empty-state">还没有推导节点。点击“新建推导节点”开始。</div>`;
  }

  function renderImageLibrary(images = []) {
    imageLibrary.innerHTML =
      images
        .map(
          (image) => `
            <button class="image-choice" type="button" data-cover="${image.url}">
              <img src="${adminSrc(image.url)}" alt="${escapeHtml(image.name)}" />
              <span>${escapeHtml(image.name)}</span>
              <small class="image-meta">${formatBytes(image.size)} / ${escapeHtml(new Date(image.updatedAt).toLocaleDateString())}</small>
            </button>
          `
        )
        .join("") || `<div class="empty-state">还没有上传图片。</div>`;
  }

  async function loadImages() {
    const result = await request("/api/uploads");
    renderImageLibrary(result.uploads || []);
  }

  function healthCard(title, ok, lines) {
    return `
      <article class="health-card ${ok ? "is-ok" : "is-bad"}">
        <strong>${escapeHtml(title)}</strong>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </article>
    `;
  }

  function renderHealth(data) {
    if (!data) {
      healthPanel.innerHTML = `<div class="empty-state">暂时无法读取系统状态。</div>`;
      return;
    }
    const backup = data.backups?.latest;
    healthPanel.innerHTML = [
      healthCard("服务", Boolean(data.ok), [
        `版本：${data.versionLabel || ""}`,
        `提交：${data.gitCommit || ""}`,
        `Node：${data.node || ""}`,
        `运行：${data.uptimeSeconds || 0} 秒`
      ]),
      healthCard("数据库", Boolean(data.databaseReady && data.databaseWritable), [
        data.databaseReady ? "数据库连接正常" : "数据库连接异常",
        data.databaseWritable ? "数据库目录可写" : "数据库目录不可写",
        `体积：${formatBytes(data.database?.totalBytes)}`
      ]),
      healthCard("上传目录", Boolean(data.uploadsWritable), [
        data.uploadsWritable ? "上传目录可写" : "上传目录不可写",
        `文件：${data.uploadsStorage?.files || 0}`,
        `体积：${formatBytes(data.uploadsStorage?.bytes)}`
      ]),
      healthCard("内容", true, [
        `公开文章：${data.publicPosts || 0}`,
        `公开项目：${data.publicProjects || 0}`,
        `管理端内容：${(data.adminPosts || 0) + (data.adminProjects || 0)}`
      ]),
      healthCard("备份", Boolean(data.backups?.exists), [
        `备份目录：${data.backups?.exists ? "可读取" : "不可读取"}`,
        `备份数量：${data.backups?.count || 0}`,
        backup ? `最近备份：${backup.name}` : "最近备份：暂无"
      ])
    ].join("");
  }
  async function loadHealth() {
    const data = await request("/api/admin/health");
    renderHealth(data);
  }

  function applySnapshotToForm(snapshot, options = {}) {
    const { dirty = false } = options;
    isRestoringForm = true;
    editingType = snapshot.editingType || null;
    editingId = snapshot.editingId || null;
    formulaDecisionCloneId = "";
    contentForm.type.value = snapshot.type || "post";
    if (contentForm.nodeType) contentForm.nodeType.value = snapshot.nodeType || "derivation";
    if (contentForm.slug) contentForm.slug.value = snapshot.slug || "";
    if (contentForm.symbol) contentForm.symbol.value = snapshot.symbol || "";
    if (contentForm.accentColor) contentForm.accentColor.value = knowledgeAccent(snapshot.accentColor || "purple");
    if (contentForm.visibilityStatus) contentForm.visibilityStatus.value = snapshot.visibilityStatus || "public";
    contentForm.title.value = snapshot.title || "";
    contentForm.excerpt.value = snapshot.excerpt || "";
    contentForm.tags.value = snapshot.tags || "";
    contentForm.markdown.value = snapshot.markdown || "";
    contentForm.publishStatus.value = snapshot.publishStatus || "draft";
    contentForm.featured.checked = Boolean(snapshot.featured);
    contentForm.featuredOrder.value = String(featuredOrderValue(snapshot.featuredOrder || 0));
    contentForm.recommendationPriority.value = String(recommendationPriorityValue(snapshot.recommendationPriority || 100));
    contentForm.readingMinutes.value = snapshot.readingMinutes ?? "";
    contentForm.category.value = snapshot.category || "模拟电子";
    contentForm.statusKey.value = snapshot.statusKey || "planned";
    contentForm.version.value = snapshot.version || "";
    contentForm.progress.value = snapshot.progress || 0;
    contentForm.repoUrl.value = snapshot.repoUrl || "";
    contentForm.bomUrl.value = snapshot.bomUrl || "";
    contentForm.docsUrl.value = snapshot.docsUrl || "";
    setCover(snapshot.cover, snapshot.cover ? "已从本地草稿恢复封面" : "", {
      dirty: false,
      crop: snapshot.coverCrop
    });
    updateTypeFields();
    updatePreview();
    updateVisibilityHint();
    if (isKnowledgeType(snapshot.type)) renderKnowledgeRevisions([], { id: snapshot.editingId || snapshot.id });
    isRestoringForm = false;
    dirty ? markDirty() : markClean();
  }

  function applyItemToForm(type, item, options = {}) {
    const { confirm = true } = options;
    if (confirm && !confirmDiscard("当前编辑器里有未保存修改，切换内容会覆盖表单，确认继续吗？")) return false;
    const isKnowledge = isKnowledgeType(type);
    applySnapshotToForm(
      {
        editingType: type,
        editingId: item.id,
        type,
        id: item.id,
        slug: item.slug || item.id || "",
        nodeType: item.nodeType || "derivation",
        symbol: item.symbol || "",
        title: item.title || "",
        excerpt: item.excerpt || item.summary || "",
        tags: item.tags || "",
        markdown: item.markdown || "",
        publishStatus: type === "post" || isKnowledge ? item.publishStatus || "draft" : item.visibilityStatus || "draft",
        visibilityStatus: item.visibilityStatus || "public",
        accentColor: item.accentColor || "purple",
        featured: Boolean(item.featured),
        featuredOrder: featuredOrderValue(item.featuredOrder || 0),
        recommendationPriority: recommendationPriorityValue(item.recommendationPriority || 100),
        readingMinutes: item.readingMinutes ?? null,
        category: item.category || "模拟电子",
        statusKey: item.statusKey || "planned",
        version: item.version || "",
        progress: item.progress || 0,
        repoUrl: item.repoUrl || "",
        bomUrl: item.bomUrl || "",
        docsUrl: item.docsUrl || "",
        cover: item.cover || "",
        coverCrop: item.coverCrop || null
      },
      { dirty: false }
    );
    setNotice(`正在编辑：${item.title || "未命名内容"}`, "info");
    window.location.hash = "editor";
    return true;
  }

  async function editItem(type, item, options = {}) {
    if (!item) return;
    if (!isKnowledgeType(type)) {
      applyItemToForm(type, item, options);
      return;
    }
    const result = await request(`/api/admin/knowledge-nodes/${encodeURIComponent(item.id || item.slug)}`);
    if (applyItemToForm(type, result.node, options)) {
      renderKnowledgeRevisions(result.revisions || [], result.node);
      setKnowledgeWarnings([]);
    }
  }

  function restoreDraftIfNeeded() {
    const draft = readDraft();
    updateDraftStatus();
    if (!draft?.snapshot || !snapshotHasContent(draft.snapshot)) return;
    const title = draft.snapshot.title ? `《${draft.snapshot.title}》` : "未命名内容";
    if (window.confirm(`检测到本地草稿 ${title}，是否恢复到编辑器？`)) {
      applySnapshotToForm(draft.snapshot, { dirty: true });
      setNotice("已恢复本地草稿。草稿尚未写入 SQLite，请确认后保存内容。", "warning");
      window.location.hash = "editor";
    }
  }

  function buildPayload() {
    const data = new FormData(contentForm);
    const type = data.get("type");
    const now = new Date().toISOString().slice(0, 10);
    const contentId = editingId || `${type}-${Date.now()}`;
    if (isKnowledgeType(type)) {
      const slug = assertKnowledgeSlug(data.get("slug"));
      return {
        endpoint: "/api/admin/knowledge-nodes",
        collectionKey: "knowledgeNodes",
        payload: {
          id: editingId || slug,
          slug,
          nodeType: data.get("nodeType") || "derivation",
          symbol: data.get("symbol"),
          title: data.get("title"),
          summary: data.get("excerpt"),
          markdown: data.get("markdown"),
          cover: currentCover || "",
          accentColor: knowledgeAccent(data.get("accentColor")),
          tags: data.get("tags"),
          publishStatus: data.get("publishStatus") || "draft",
          visibilityStatus: data.get("visibilityStatus") || "public"
        }
      };
    }

    const base = {
      id: contentId,
      slug: contentId,
      type,
      title: data.get("title"),
      cover: currentCover || (type === "post" ? "./assets/covers/analog-cover.png" : "./assets/covers/project-cover.png"),
      markdown: data.get("markdown"),
      tags: data.get("tags"),
      date: now,
      featured: data.get("featured") === "on",
      featuredOrder: featuredOrderValue(data.get("featuredOrder") || 0),
      recommendationPriority: recommendationPriorityValue(data.get("recommendationPriority") || 100)
    };

    if (type === "post") {
      const category = data.get("category");
      const rawReadingMinutes = String(data.get("readingMinutes") || "").trim();
      if (rawReadingMinutes && (!/^[1-9]\d*$/.test(rawReadingMinutes) || Number(rawReadingMinutes) > 9999)) {
        throw new Error("建议阅读时间必须是 1-9999 的正整数分钟或留空");
      }
      return {
        endpoint: "/api/posts",
        collectionKey: "posts",
        payload: {
          ...base,
          category,
          categoryKey: categoryKey(category),
          coverCrop: currentCoverCrop ? { ...currentCoverCrop } : null,
          publishStatus: data.get("publishStatus"),
          readingMinutes: rawReadingMinutes ? Number(rawReadingMinutes) : null,
          excerpt: data.get("excerpt")
        }
      };
    }

    const statusKey = data.get("statusKey");
    return {
      endpoint: "/api/projects",
      collectionKey: "projects",
      payload: {
        ...base,
        statusKey,
        status: statusText(statusKey),
        visibilityStatus: data.get("publishStatus"),
        summary: data.get("excerpt"),
        license: "MIT License",
        stars: 0,
        version: data.get("version"),
        progress: Number(data.get("progress") || 0),
        repoUrl: data.get("repoUrl"),
        bomUrl: data.get("bomUrl"),
        docsUrl: data.get("docsUrl")
      }
    };
  }

  function validateFeaturedPayload(payload) {
    if (isKnowledgeType(payload.type)) return;
    if (!payload.featured) return;
    const order = featuredOrderValue(payload.featuredOrder);
    const sameItem = (item) => item.contentType === payload.type && item.id === payload.id;
    const existing = featuredItems().filter((item) => !sameItem(item));
    if (existing.length >= featuredLimit) {
      throw new Error("首页轮播最多只能设置 4 个内容，请先取消一个已有轮播项");
    }
    const conflict = existing.find((item) => featuredOrderValue(item.featuredOrder) === order);
    if (conflict) {
      throw new Error(`首页轮播${featuredSlotLabel(order)}已被《${conflict.title || "未命名内容"}》使用，请选择空着的位置`);
    }
  }

  async function saveItemFeatured(item, featured, order = item.featuredOrder) {
    if (item.contentType === "post") {
      const payload = { ...item, type: "post", featured: Boolean(featured), featuredOrder: featuredOrderValue(order) };
      const result = await request("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      serverContent = { ...serverContent, posts: result.posts, carousel: result.carousel || serverContent.carousel };
      return;
    }

    const payload = { ...item, type: "project", featured: Boolean(featured), featuredOrder: featuredOrderValue(order) };
    const result = await request("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    serverContent = { ...serverContent, projects: result.projects, carousel: result.carousel || serverContent.carousel };
  }

  function assignCurrentToFeaturedSlot(order) {
    if (isKnowledgeType(getType())) {
      setNotice("推导节点不进入首页轮播。", "warning");
      return;
    }
    contentForm.featured.checked = true;
    contentForm.featuredOrder.value = String(featuredOrderValue(order));
    updateVisibilityHint();
    markDirty();
    renderFeaturedSlots();
    setNotice(`已把当前编辑内容安排到首页轮播${featuredSlotLabel(order)}，保存后生效。`, "warning");
  }

  function selectedItems() {
    const itemMap = new Map(combinedItems().map((item) => [itemKey(item), item]));
    return [...selectedContent].map((key) => itemMap.get(key)).filter(Boolean);
  }

  async function saveItemStatus(item, status) {
    if (item.contentType === "knowledge_node") {
      const payload = {
        ...item,
        id: item.id,
        slug: item.slug || item.id,
        nodeType: item.nodeType || "derivation",
        symbol: item.symbol || "",
        title: item.title || "",
        summary: item.summary || "",
        markdown: item.markdown || "",
        cover: item.cover || "",
        accentColor: knowledgeAccent(item.accentColor),
        tags: item.tags || "",
        publishStatus: status,
        visibilityStatus: item.visibilityStatus || "public"
      };
      const result = await request("/api/admin/knowledge-nodes", { method: "POST", body: JSON.stringify(payload) });
      serverContent = { ...serverContent, knowledgeNodes: result.nodes || [] };
      setKnowledgeWarnings(result.warnings || []);
      return;
    }
    if (item.contentType === "post") {
      const payload = { ...item, type: "post", publishStatus: status };
      const result = await request("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      serverContent = { ...serverContent, posts: result.posts, carousel: result.carousel || serverContent.carousel };
      return;
    }

    const payload = { ...item, type: "project", visibilityStatus: status };
    const result = await request("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    serverContent = { ...serverContent, projects: result.projects, carousel: result.carousel || serverContent.carousel };
  }

  async function mutateItem(item, action) {
    const collectionKey = collectionKeyForType(item.contentType);
    const basePath = item.contentType === "knowledge_node" ? "admin/knowledge-nodes" : item.contentType === "project" ? "projects" : "posts";
    let result;

    if (action === "publish") {
      await saveItemStatus(item, "published");
      return;
    }
    if (action === "draft") {
      await saveItemStatus(item, "draft");
      return;
    }
    if (action === "delete") {
      result = await request(`/api/${basePath}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    }
    if (action === "restore") {
      result = await request(`/api/${basePath}/${encodeURIComponent(item.id)}/restore`, { method: "POST", body: "{}" });
    }
    if (result) serverContent = { ...serverContent, [collectionKey]: resultCollection(result, collectionKey) };
  }

  async function runBulkAction(action, button, label, confirmMessage) {
    const items = selectedItems();
    if (!items.length) {
      setNotice("请先选择内容。", "warning");
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage.replace("{count}", items.length))) return;

    await withBusy(button, label, async () => {
      for (const item of items) {
        await mutateItem(item, action);
      }
      selectedContent.clear();
      renderList(); renderRecentContent();
      setNotice(`批量操作完成：${items.length} 项。`, "success");
    });
    updateBulkState();
  }

  function formulaLatexHtml(latex) {
    return renderMarkdown(`$$\n${String(latex || "")}\n$$`);
  }

  function formulaStatusLabel(card) {
    if (card.publishStatus === "archived") return "已归档";
    if (card.publishStatus === "published") return card.pendingPublication ? "已发布 · 有待发布修订" : "已发布";
    return "草稿";
  }

  function formulaClassificationNameKey(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\u00a0\u3000]/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim()
      .toLocaleLowerCase("zh-CN");
  }

  function formulaCreateTagValues() {
    return String(formulaCreateTags?.value || "")
      .split(/[\n,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function uniqueFormulaClassificationValues(values) {
    const seen = new Set();
    return (values || []).filter((value) => {
      const key = formulaClassificationNameKey(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderFormulaCreateSelectedTags() {
    if (!formulaCreateSelectedTags) return;
    formulaCreateSelectedTags.innerHTML =
      formulaCreateTagValues()
        .map(
          (tag) =>
            `<span>${escapeHtml(tag)}<button type="button" data-formula-create-remove-tag="${escapeHtml(
              tag
            )}" aria-label="移除标签 ${escapeHtml(tag)}">×</button></span>`
        )
        .join("") || "<em>尚未选择标签</em>";
  }

  function setFormulaCreateTags(tags) {
    if (formulaCreateTags) {
      formulaCreateTags.value = uniqueFormulaClassificationValues(
        (tags || []).map((tag) => String(tag).trim()).filter(Boolean)
      ).join("\n");
    }
    renderFormulaCreateSelectedTags();
  }

  function selectedFormulaCreateModule() {
    const value = String(formulaCreateModule?.value || "").trim();
    const key = formulaClassificationNameKey(value);
    return (
      formulaClassifications.find(
        (item) =>
          item.kind === "module" &&
          (item.slug === value || formulaClassificationNameKey(item.displayName) === key)
      ) || null
    );
  }

  function selectedFormulaCreateCategory(moduleSlug = selectedFormulaCreateModule()?.slug || "") {
    const value = String(formulaCreateCategory?.value || "").trim();
    const key = formulaClassificationNameKey(value);
    return (
      formulaClassifications.find(
        (item) =>
          item.kind === "category" &&
          item.parentSlug === moduleSlug &&
          formulaClassificationNameKey(item.displayName) === key
      ) || null
    );
  }

  async function createFormulaSelectionClassification(kind) {
    const module = selectedFormulaCreateModule();
    const displayName = String(
      kind === "module" ? formulaCreateModule?.value : formulaCreateCategory?.value
    ).trim();
    if (!displayName) throw new Error(`请先输入${kind === "module" ? "模块" : "主分类"}名称`);
    if (kind === "category" && !module) {
      throw new Error("请先选择已有模块，或明确点击“新增模块”");
    }
    const classification = await createFormulaClassification(
      kind,
      displayName,
      kind === "category" ? module.slug : ""
    );
    if (kind === "module") {
      formulaCreateModule.value = classification.slug;
      formulaCreateCategory.value = "";
    } else {
      formulaCreateCategory.value = classification.displayName;
    }
    renderFormulaClassificationOptions();
    setNotice(
      `${kind === "module" ? "模块" : "主分类"}已明确登记：${classification.displayName}`,
      "success"
    );
  }

  async function addFormulaCreateTag() {
    const value = String(formulaCreateTagPicker?.value || "").trim();
    if (!value) return;
    if (!/^[a-z0-9][a-z0-9-]{0,31}:[^,，、\s].{0,63}$/i.test(value)) {
      throw new Error("标签必须使用 namespace:value 格式，例如 unit:V");
    }
    const key = formulaClassificationNameKey(value);
    const existing = formulaClassifications.find(
      (item) => item.kind === "tag" && formulaClassificationNameKey(item.displayName) === key
    );
    const classification = existing || (await createFormulaClassification("tag", value));
    setFormulaCreateTags([...formulaCreateTagValues(), classification.displayName]);
    formulaCreateTagPicker.value = "";
  }

  function formulaSelectedTagValues() {
    return String(formulaFormField("tags")?.value || "")
      .split(/[\n,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function renderFormulaSelectedTags() {
    if (!formulaSelectedTags) return;
    formulaSelectedTags.innerHTML =
      formulaSelectedTagValues()
        .map(
          (tag) =>
            `<span>${escapeHtml(tag)}<button type="button" data-formula-remove-tag="${escapeHtml(tag)}" aria-label="移除标签 ${escapeHtml(
              tag
            )}">×</button></span>`
        )
        .join("") || "<em>尚未选择标签</em>";
  }

  function setFormulaSelectedTags(tags) {
    const field = formulaFormField("tags");
    if (field) field.value = [...new Set((tags || []).map((tag) => String(tag).trim()).filter(Boolean))].join("\n");
    renderFormulaSelectedTags();
  }

  async function addFormulaSelectedTag() {
    const value = String(formulaTagPicker?.value || "").trim();
    if (!value) return;
    if (!/^[a-z0-9][a-z0-9-]{0,31}:[^,，、\s].{0,63}$/i.test(value)) {
      throw new Error("标签必须使用 namespace:value 格式，例如 unit:V");
    }
    const existing = formulaClassifications.find(
      (item) => item.kind === "tag" && item.displayName.toLocaleLowerCase("zh-CN") === value.toLocaleLowerCase("zh-CN")
    );
    const classification = existing || (await createFormulaClassification("tag", value));
    setFormulaSelectedTags([...formulaSelectedTagValues(), classification.displayName]);
    formulaTagPicker.value = "";
  }

  function renderFormulaClassificationOptions() {
    const classifications = formulaClassifications || [];
    const modules = classifications.filter((item) => item.kind === "module");
    const selectedModule = !formulaCardEditor?.hidden
      ? formulaFormField("moduleKey")?.value || ""
      : selectedFormulaCreateModule()?.slug ||
        formulaCreateModule?.value ||
        formulaClassificationParent?.value ||
        "";
    const categories = classifications.filter(
      (item) => item.kind === "category" && (!selectedModule || item.parentSlug === selectedModule)
    );
    const tags = classifications.filter((item) => item.kind === "tag");
    if (formulaModuleOptions) {
      formulaModuleOptions.innerHTML = modules
        .map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.displayName)}</option>`)
        .join("");
    }
    if (formulaCategoryOptions) {
      formulaCategoryOptions.innerHTML = categories
        .map((item) => `<option value="${escapeHtml(item.displayName)}">${escapeHtml(item.parentSlug)}</option>`)
        .join("");
    }
    if (formulaTagOptions) {
      formulaTagOptions.innerHTML = tags
        .map((item) => `<option value="${escapeHtml(item.displayName)}">${escapeHtml(item.displayName)}</option>`)
        .join("");
    }
    renderFormulaClassificationManager();
  }

  function renderFormulaClassificationManager() {
    if (!formulaClassificationList) return;
    const kind = formulaClassificationKind?.value || "module";
    const parent = String(formulaClassificationParent?.value || "").trim();
    const items = formulaClassifications.filter(
      (item) => item.kind === kind && (kind !== "category" || !parent || item.parentSlug === parent)
    );
    formulaClassificationParentField.hidden = kind !== "category";
    formulaClassificationList.innerHTML =
      items
        .map(
          (item) =>
            `<span><strong>${escapeHtml(item.displayName)}</strong><code>${escapeHtml(item.slug)}</code><em>${escapeHtml(
              item.usageCount || 0
            )} 张卡</em></span>`
        )
        .join("") || "<em>当前范围没有已登记选项。</em>";
  }

  async function createFormulaClassification(kind, displayName, parentSlug = "", confirmCreate = false) {
    try {
      const result = await request("/api/admin/formula-classifications", {
        method: "POST",
        body: JSON.stringify({ kind, displayName, parentSlug, confirmCreate })
      });
      formulaClassifications = result.classifications || formulaClassifications;
      formulaCatalogState.facets.classifications = formulaClassifications;
      renderFormulaClassificationOptions();
      return result.classification;
    } catch (error) {
      if (!confirmCreate && /可能重复/u.test(error.message) && window.confirm(`${error.message}\n仍要新建独立选项吗？`)) {
        return createFormulaClassification(kind, displayName, parentSlug, true);
      }
      throw error;
    }
  }

  async function createFormulaClassificationFromManager() {
    const kind = formulaClassificationKind.value;
    const displayName = formulaClassificationName.value.trim();
    const parentSlug = kind === "category" ? formulaClassificationParent.value.trim() : "";
    if (!displayName) throw new Error("请输入要新建的分类名称");
    if (kind === "category" && !parentSlug) throw new Error("新建主分类时必须选择所属模块");
    const classification = await createFormulaClassification(kind, displayName, parentSlug);
    formulaClassificationName.value = "";
    setNotice(`公式${kind === "module" ? "模块" : kind === "category" ? "主分类" : "标签"}已登记：${classification.displayName}`, "success");
  }

  async function createFormulaClassificationFromEditor(kind) {
    const moduleField = formulaFormField("moduleKey");
    const categoryField = formulaFormField("categoryPath");
    const displayName = String(kind === "module" ? moduleField?.value : categoryField?.value).trim();
    const parentSlug = kind === "category" ? String(moduleField?.value || "").trim() : "";
    if (!displayName) throw new Error(`请先输入${kind === "module" ? "模块" : "主分类"}名称`);
    if (kind === "category" && !parentSlug) throw new Error("请先选择所属模块");
    const classification = await createFormulaClassification(kind, displayName, parentSlug);
    if (kind === "module") moduleField.value = classification.slug;
    else categoryField.value = classification.displayName;
    renderFormulaClassificationOptions();
  }

  function showFormulaFieldHelp(button, expanded = false) {
    if (!formulaFieldHelpPopover || !button) return;
    formulaFieldHelpPopover.textContent = button.dataset.formulaHelp || "";
    formulaFieldHelpPopover.hidden = false;
    const rect = button.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    formulaFieldHelpPopover.style.width = `${width}px`;
    formulaFieldHelpPopover.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    formulaFieldHelpPopover.style.top = `${Math.min(window.innerHeight - 96, rect.bottom + 8)}px`;
    button.setAttribute("aria-expanded", String(expanded));
  }

  function hideFormulaFieldHelp(button) {
    if (formulaFieldHelpPopover) formulaFieldHelpPopover.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function formulaCategoryCount(category) {
    const status = formulaCatalogState.selection.publishStatus || "all";
    if (status === "draft") return category.draftCount || 0;
    if (status === "published") return category.publishedCount || 0;
    if (status === "archived") return category.archivedCount || 0;
    return (category.activeCount || 0) + (category.archivedCount || 0);
  }

  function renderFormulaCategories() {
    if (!formulaCategoryTree) return;
    const modules = formulaCatalogState.facets.modules || [];
    formulaCategoryTree.innerHTML =
      modules
        .map(
          (module) => `
            <div class="formula-category-module">${escapeHtml(
              formulaClassifications.find((item) => item.kind === "module" && item.slug === module.moduleKey)?.displayName ||
                module.moduleKey
            )}</div>
            ${(module.categories || [])
              .map((category) => {
                const selected =
                  formulaCatalogState.selection.moduleKey === module.moduleKey &&
                  formulaCatalogState.selection.categoryPath === category.categoryPath;
                return `
                  <button class="formula-category-button ${selected ? "is-active" : ""}" type="button"
                    data-module="${escapeHtml(module.moduleKey)}" data-category="${escapeHtml(category.categoryPath)}">
                    ${escapeHtml(category.categoryPath)} <strong>${formulaCategoryCount(category)}</strong>
                  </button>`;
              })
              .join("")}`
        )
        .join("") || `<div class="empty-state">尚无公式分类。</div>`;
  }

  function renderFormulaTagOptions() {
    if (!formulaTagFilter) return;
    const selected = formulaCatalogState.selection.tag || "";
    formulaTagFilter.innerHTML = `<option value="">全部标签</option>${(formulaCatalogState.facets.tags || [])
      .map((tag) => `<option value="${escapeHtml(tag.tagKey)}">${escapeHtml(tag.tagKey)}</option>`)
      .join("")}`;
    formulaTagFilter.value = selected;
  }

  function renderFormulaCards() {
    if (!formulaCardList || !formulaCatalogSummary) return;
    const { items, selection, pagination } = formulaCatalogState;
    formulaCatalogSummary.textContent = selection.categoryPath
      ? `${selection.moduleKey} / ${selection.categoryPath} · ${pagination.total} 条`
      : "请选择分类。";
    formulaCardList.innerHTML =
      items
        .map(
          (card) => `
            <article class="formula-card-row is-${escapeHtml(card.publishStatus || "draft")} ${
              card.archiveState === "archived" ? "is-archived" : ""
            }">
              <div>
                <h3>${escapeHtml(card.displayName)}</h3>
                <div class="formula-card-meta">
                  <code>${escapeHtml(card.formulaId)}</code>
                  <span class="formula-status-badge is-${escapeHtml(card.publishStatus || "draft")}">${escapeHtml(
                    formulaStatusLabel(card)
                  )}</span>
                  <span>修订 ${escapeHtml(card.currentRevisionSequence || 1)}</span>
                </div>
                ${card.purpose ? `<p>${escapeHtml(card.purpose)}</p>` : ""}
                <div class="formula-card-tags">${(card.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
                <div class="formula-card-latex">${formulaLatexHtml(card.latex)}</div>
              </div>
              <div class="row-actions">
                <button class="button secondary" type="button" data-formula-action="edit" data-formula-id="${escapeHtml(card.formulaId)}">编辑</button>
                ${
                  card.publishStatus !== "archived" && (card.publishStatus !== "published" || card.pendingPublication)
                    ? `<button class="button primary" type="button" data-formula-action="publish" data-formula-id="${escapeHtml(
                        card.formulaId
                      )}">${card.publishStatus === "published" ? "发布修订" : "发布"}</button>`
                    : ""
                }
                ${
                  card.publishStatus === "archived"
                    ? `<button class="button secondary" type="button" data-formula-action="restore" data-formula-id="${escapeHtml(card.formulaId)}">恢复</button>`
                    : `<button class="button secondary" type="button" data-formula-action="archive" data-formula-id="${escapeHtml(card.formulaId)}">归档</button>`
                }
              </div>
            </article>`
        )
        .join("") || `<div class="empty-state">${selection.categoryPath ? "当前条件下没有公式卡。" : "选择左侧分类后加载公式卡。"}</div>`;
    if (formulaPageStatus) {
      formulaPageStatus.textContent = pagination.pageCount
        ? `第 ${pagination.page} / ${pagination.pageCount} 页`
        : "第 0 页";
    }
    if (formulaPreviousPage) formulaPreviousPage.disabled = pagination.page <= 1;
    if (formulaNextPage) formulaNextPage.disabled = !pagination.pageCount || pagination.page >= pagination.pageCount;
  }

  function formulaRelationIssueLabel(issueCode) {
    return {
      ambiguous_target: "目标歧义",
      missing_source: "来源缺失",
      missing_target: "目标缺失",
      duplicate_dependency: "重复依赖",
      self_reference: "自环",
      evidence_conflict: "证据冲突",
      cycle: "成环",
      archived_target: "目标已归档",
      invalid_shortcode: "短码无效",
      relation_without_revision: "来源无修订"
    }[issueCode] || issueCode;
  }

  function renderFormulaRelationRepairs() {
    if (!formulaRepairList || !formulaRepairSummary) return;
    const items = formulaRelationRepairState.items || [];
    formulaRepairStatus.value = formulaRelationRepairState.status;
    formulaRepairIssue.value = formulaRelationRepairState.issueCode;
    formulaRepairSummary.textContent = `${items.length} 项 · 仅追加复核记录`;
    formulaRepairList.innerHTML =
      items
        .map((repair) => {
          const resolved = repair.status === "resolved";
          const candidates = Array.isArray(repair.candidateTargetIds)
            ? repair.candidateTargetIds
            : [];
          const candidateHtml = candidates.length
            ? `<div class="formula-repair-candidates" aria-label="候选目标">${candidates
                .map((formulaId) => `<code>${escapeHtml(formulaId)}</code>`)
                .join("")}</div>`
            : `<span class="formula-repair-none">无可确认候选</span>`;
          const latestNote = repair.latestEvent?.evidence?.note || "";
          return `
            <article class="formula-repair-item" data-formula-repair-id="${escapeHtml(repair.repairId)}">
              <div class="formula-repair-heading">
                <div>
                  <span class="formula-status-badge ${resolved ? "is-published" : "is-draft"}">${resolved ? "已结案" : "待处理"}</span>
                  <strong>${escapeHtml(formulaRelationIssueLabel(repair.issueCode))}</strong>
                </div>
                <code>${escapeHtml(repair.repairId)}</code>
              </div>
              <p>${escapeHtml(repair.reason)}</p>
              <dl class="formula-repair-meta">
                <div><dt>来源公式</dt><dd>${escapeHtml(repair.sourceDisplayName || repair.sourceFormulaId || "未识别")}</dd></div>
                <div><dt>来源修订</dt><dd><code>${escapeHtml(repair.sourceRevisionId || "未建立")}</code></dd></div>
                <div><dt>旧引用</dt><dd><code>${escapeHtml(repair.targetReference || "无")}</code></dd></div>
                <div><dt>证据位置</dt><dd><code>${escapeHtml(`${repair.sourceTable}:${repair.sourceKey}`)}</code></dd></div>
              </dl>
              <div class="formula-repair-candidate-row">
                <span>迁移候选</span>
                ${candidateHtml}
              </div>
              ${
                resolved
                  ? `<div class="formula-repair-resolution">
                      <span>结案目标</span>
                      <strong>${escapeHtml(repair.latestEvent?.targetDisplayName || repair.latestEvent?.targetFormulaId || "")}</strong>
                      <code>${escapeHtml(repair.latestEvent?.targetFormulaId || "")}</code>
                      <p>${escapeHtml(latestNote)}</p>
                    </div>
                    <div class="formula-repair-actions">
                      <label>重新打开说明<textarea rows="2" maxlength="500" data-formula-repair-note></textarea></label>
                      <button class="button secondary" type="button" data-formula-repair-action="reopened">重新打开</button>
                    </div>`
                  : `<div class="formula-repair-actions">
                      <label>已保存的目标 formulaId<input maxlength="128" data-formula-repair-target placeholder="手动填写，不自动选择" /></label>
                      <label>复核证据<textarea rows="2" maxlength="500" data-formula-repair-note placeholder="记录人工核对依据"></textarea></label>
                      <div class="row-actions">
                        ${repair.sourceFormulaId ? `<button class="button secondary" type="button" data-formula-repair-action="open-source" data-formula-id="${escapeHtml(repair.sourceFormulaId)}">打开来源公式</button>` : ""}
                        <button class="button primary" type="button" data-formula-repair-action="resolved">校验关系并结案</button>
                      </div>
                    </div>`
              }
            </article>`;
        })
        .join("") || `<div class="empty-state">当前筛选条件下没有关系待修复事项。</div>`;
  }

  async function loadFormulaRelationRepairs() {
    const params = new URLSearchParams({ status: formulaRelationRepairState.status });
    if (formulaRelationRepairState.issueCode) {
      params.set("issue", formulaRelationRepairState.issueCode);
    }
    const result = await request(`/api/admin/formula-relation-repairs?${params.toString()}`);
    formulaRelationRepairState.items = result.repairs || [];
    formulaRelationRepairState.loaded = true;
    renderFormulaRelationRepairs();
  }

  async function appendFormulaRelationRepairEvent(repairId, eventType, container) {
    const note = container.querySelector("[data-formula-repair-note]")?.value.trim() || "";
    const targetFormulaId =
      container.querySelector("[data-formula-repair-target]")?.value.trim() || "";
    if (!note) throw new Error("请填写复核证据");
    if (eventType === "resolved" && !targetFormulaId) {
      throw new Error("请手动填写已经保存到来源修订的目标 formulaId");
    }
    await request(`/api/admin/formula-relation-repairs/${encodeURIComponent(repairId)}/events`, {
      method: "POST",
      body: JSON.stringify({ eventType, targetFormulaId, note })
    });
    await loadFormulaRelationRepairs();
    setNotice(eventType === "resolved" ? "关系已核验并追加结案记录。" : "待修复事项已重新打开。", "success");
  }

  function renderFormulaCatalog() {
    if (formulaSearchInput) formulaSearchInput.value = formulaCatalogState.selection.query || "";
    if (formulaArchiveFilter) formulaArchiveFilter.value = formulaCatalogState.selection.publishStatus || "all";
    renderFormulaCategories();
    renderFormulaTagOptions();
    renderFormulaClassificationOptions();
    renderFormulaCards();
  }

  async function loadFormulaCatalog(options = {}) {
    if (!formulaCategoryTree) return;
    const params = new URLSearchParams({
      module: formulaCatalogState.selection.moduleKey || "",
      category: formulaCatalogState.selection.categoryPath || "",
      q: formulaCatalogState.selection.query || "",
      tag: formulaCatalogState.selection.tag || "",
      archiveState: "all",
      publishStatus: formulaCatalogState.selection.publishStatus || "all",
      page: String(formulaCatalogState.pagination.page || 1),
      pageSize: String(formulaCatalogState.pagination.pageSize || 12)
    });
    const result = await request(`/api/admin/formulas?${params.toString()}`);
    formulaCatalogState.facets = result.facets || { modules: [], tags: [], classifications: [] };
    formulaClassifications = formulaCatalogState.facets.classifications || [];
    formulaCatalogState.items = result.items || [];
    formulaCatalogState.selection = { ...formulaCatalogState.selection, ...(result.selection || {}) };
    formulaCatalogState.pagination = { ...formulaCatalogState.pagination, ...(result.pagination || {}) };
    formulaCatalogState.loaded = true;

    if (result.requiresCategory && options.selectDefault !== false) {
      const firstModule = formulaCatalogState.facets.modules?.[0];
      const firstCategory = firstModule?.categories?.[0];
      if (firstModule && firstCategory) {
        formulaCatalogState.selection.moduleKey = firstModule.moduleKey;
        formulaCatalogState.selection.categoryPath = firstCategory.categoryPath;
        formulaCatalogState.pagination.page = 1;
        return loadFormulaCatalog({ selectDefault: false });
      }
    }
    renderFormulaCatalog();
  }

  function formulaFormField(name) {
    return formulaCardEditor?.elements?.namedItem(name);
  }

  function renderFormulaTechnicalInfo(card = null) {
    if (!formulaTechnicalInfo) return;
    const visible = Boolean(card?.formulaId && card?.slug);
    formulaTechnicalInfo.hidden = !visible;
    if (formulaTechnicalId) formulaTechnicalId.textContent = visible ? card.formulaId : "";
    if (formulaTechnicalSlug) formulaTechnicalSlug.textContent = visible ? card.slug : "";
    if (formulaCopyStatus) formulaCopyStatus.textContent = "";
  }

  function selectFormulaTechnicalText(element) {
    const selection = window.getSelection?.();
    if (!selection || !element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus();
  }

  async function copyFormulaTechnicalValue(key) {
    const element = key === "formulaId" ? formulaTechnicalId : formulaTechnicalSlug;
    const value = String(element?.textContent || "").trim();
    if (!value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (formulaCopyStatus) formulaCopyStatus.textContent = `${key} 已复制`;
    } catch {
      selectFormulaTechnicalText(element);
      if (formulaCopyStatus) formulaCopyStatus.textContent = `${key} 已选中，请按 Ctrl+C 复制`;
    }
  }

  function renderFormulaRevisions(revisions = []) {
    if (!formulaRevisionList) return;
    formulaRevisionList.innerHTML =
      revisions
        .map(
          (revision) => `
            <div class="formula-revision-row">
              <strong>#${escapeHtml(revision.sequence)} · ${escapeHtml(revision.revisionReason || "save")}
                <span class="formula-status-badge ${revision.wasPublished ? "is-published" : "is-draft"}">${
                  revision.wasPublished ? "已发布过" : "未发布"
                }</span>
              </strong>
              <code>${escapeHtml(revision.revisionId)}</code>
              <span>${escapeHtml(revision.createdAt || "")}${revision.sourceBookId ? ` · ${escapeHtml(revision.sourceBookId)}` : ""}</span>
              <div>${formulaLatexHtml(revision.latex)}</div>
              <details>
                <summary>Markdown 推导</summary>
                <div class="formula-revision-markdown markdown-article">${
                  String(revision.markdownDerivation || "").trim()
                    ? renderMarkdown(revision.markdownDerivation)
                    : '<p class="empty-state">此修订没有 Markdown 推导正文。</p>'
                }</div>
              </details>
            </div>`
        )
        .join("") || `<div class="empty-state">保存后会生成第一条不可变修订。</div>`;
  }

  function formulaRelationCardHtml(card, options = {}) {
    if (!card) return `<div class="empty-state">尚未设置。</div>`;
    const archived = card.archiveState === "archived" || card.available === false;
    return `
      <article class="formula-relation-row ${archived ? "is-broken" : ""}">
        <div>
          <strong>${escapeHtml(card.displayName || card.formulaId)}</strong>
          <code>${escapeHtml(card.formulaId)}</code>
          <span>${archived ? "已归档 · 链路中断" : `${escapeHtml(card.moduleKey || "")} / ${escapeHtml(card.categoryPath || "")}`}</span>
        </div>
        <div class="row-actions">
          ${
            !archived && card.slug
              ? `<a class="button secondary" href="../derive.html?formula=${encodeURIComponent(card.slug)}" target="_blank" rel="noopener">访客页</a>`
              : ""
          }
          ${
            options.removable
              ? `<button class="button secondary" type="button" data-formula-dependency-remove="${escapeHtml(card.formulaId)}">移除短码</button>`
              : ""
          }
        </div>
      </article>`;
  }

  function renderFormulaDerivation(card) {
    formulaEditingCard = card || null;
    if (!formulaDerivationPanel) return;
    formulaDerivationPanel.hidden = !card;
    formulaAdminGraphInstance?.destroy();
    formulaAdminGraphInstance = null;
    formulaDependencyPreview.clear();
    if (!card) return;
    const derivation = card.derivation || {
      incoming: [],
      dependencies: [],
      affectedSources: [],
      brokenCount: 0,
      publicationBlockers: []
    };
    const incoming = derivation.incoming || [];
    const dependencies = derivation.dependencies || [];
    [...incoming, ...dependencies].forEach((item) => {
      if (item?.formulaId) formulaDependencyPreview.set(item.formulaId, item);
    });
    if (formulaDerivationImpact) {
      formulaDerivationImpact.textContent = `当前修订含 ${dependencies.length} 个依赖，被 ${incoming.length} 个上级公式引用。`;
    }
    if (formulaDerivationWarning) {
      const broken = Number(derivation.brokenCount || 0);
      const blockers = derivation.publicationBlockers || [];
      const messages = [];
      if (broken) messages.push(`检测到 ${broken} 处归档依赖。`);
      if (blockers.length) {
        messages.push(
          `发布阻断：${blockers
            .map((blocker) => blocker.displayName || blocker.formulaId)
            .join("、")} 尚未处于可公开状态。`
        );
      }
      if (card.pendingPublication) {
        messages.push("当前图谱来自待发布修订；游客仍读取上一条已发布图谱。");
      }
      formulaDerivationWarning.hidden = !messages.length;
      formulaDerivationWarning.textContent = messages.join(" ");
    }
    if (formulaIncomingList) {
      formulaIncomingList.innerHTML =
        incoming.map((source) => formulaRelationCardHtml(source)).join("") ||
        `<div class="empty-state">当前没有其他公式引用本式。</div>`;
    }
    if (formulaNextRelation) {
      formulaNextRelation.innerHTML =
        dependencies
          .map((dependency) => formulaRelationCardHtml(dependency, { removable: true }))
          .join("") ||
        `<div class="empty-state">当前修订没有下级依赖。</div>`;
    }
    if (formulaNextTarget) formulaNextTarget.value = "";
    if (formulaAdminGraph && window.LarkixFormulaGraph) {
      formulaAdminGraphInstance = window.LarkixFormulaGraph.mount(
        formulaAdminGraph,
        card.graph,
        {
          hrefPrefix: "../derive.html?formula=",
          articleHrefPrefix: "/post.html?id=",
          onNavigate(href, slug) {
            const node = card.graph?.nodes?.find((candidate) => candidate.slug === slug);
            if (node?.nodeType === "formula" && node.formulaId) {
              editFormulaCard(node.formulaId).catch((error) => setNotice(error.message, "error"));
              return;
            }
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }
      );
    }
  }

  async function loadFormulaDerivationCandidates(query) {
    if (!formulaDerivationCandidates) return;
    const value = String(query || "").trim();
    if (value.length < 2) {
      formulaDerivationCandidates.innerHTML = "";
      return;
    }
    const params = new URLSearchParams({
      authoring: "1",
      q: value,
      archiveState: "all",
      page: "1",
      pageSize: "20"
    });
    const result = await request(`/api/admin/formulas?${params.toString()}`);
    const candidates = (result.items || []).filter(
      (card) => card.formulaId !== formulaEditingCard?.formulaId
    );
    candidates.forEach((card) => formulaDependencyPreview.set(card.formulaId, card));
    formulaDerivationCandidates.innerHTML = candidates
      .map(
        (card) =>
          `<option value="${escapeHtml(card.formulaId)}">${escapeHtml(card.displayName)} · ${
            card.archiveState === "archived" ? "已归档" : "使用中"
          }</option>`
      )
      .join("");
  }

  function scheduleFormulaDerivationCandidates(value) {
    window.clearTimeout(formulaDerivationSearchTimer);
    formulaDerivationSearchTimer = window.setTimeout(() => {
      loadFormulaDerivationCandidates(value).catch((error) => setNotice(error.message, "error"));
    }, 180);
  }

  async function refreshFormulaEditor(id, options = {}) {
    const result = await request(`/api/admin/formulas/${encodeURIComponent(id)}`);
    populateFormulaEditor(result.card, { scroll: options.scroll === true });
    return result.card;
  }

  function markdownDependencyIds() {
    const markdown = String(formulaFormField("markdownDerivation")?.value || "");
    return [...markdown.matchAll(/\{\{formula-ref:([a-z0-9][a-z0-9._-]{1,127})\}\}/g)].map(
      (match) => match[1]
    );
  }

  function renderDraftDependencyList() {
    if (!formulaNextRelation) return;
    const ids = markdownDependencyIds();
    formulaNextRelation.innerHTML =
      ids
        .map((formulaId) => {
          const dependency = formulaDependencyPreview.get(formulaId) || {
            formulaId,
            displayName: formulaId,
            moduleKey: "尚未解析",
            categoryPath: "保存时校验",
            available: true
          };
          return formulaRelationCardHtml(dependency, { removable: true });
        })
        .join("") || `<div class="empty-state">当前 Markdown 没有公式依赖短码。</div>`;
  }

  async function insertFormulaDependencyShortcode() {
    const targetFormulaId = String(formulaNextTarget?.value || "").trim();
    const sourceFormulaId = String(formulaEditingCard?.formulaId || "");
    if (!sourceFormulaId) throw new Error("请先保存公式卡，再插入依赖。");
    if (!targetFormulaId) throw new Error("请输入依赖公式的 formulaId。");
    if (targetFormulaId === sourceFormulaId) throw new Error("公式卡不能依赖自身。");
    if (markdownDependencyIds().includes(targetFormulaId)) {
      throw new Error(`当前 Markdown 已引用 ${targetFormulaId}，不能重复插入。`);
    }
    const targetResult = await request(
      `/api/admin/formulas/${encodeURIComponent(targetFormulaId)}`
    );
    const target = targetResult.card;
    formulaDependencyPreview.set(target.formulaId, target);
    const field = formulaFormField("markdownDerivation");
    const marker = `{{formula-ref:${target.formulaId}}}`;
    const start = Number(field.selectionStart || field.value.length);
    const end = Number(field.selectionEnd || start);
    const before = field.value.slice(0, start);
    const after = field.value.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
    field.value = `${before}${prefix}${marker}${suffix}${after}`;
    const cursor = before.length + prefix.length + marker.length;
    field.focus();
    field.setSelectionRange(cursor, cursor);
    if (formulaNextTarget) formulaNextTarget.value = "";
    updateFormulaEditorPreview();
    setNotice("依赖短码已插入；保存公式卡后执行悬空与循环校验。", "warning");
  }

  function removeFormulaDependencyShortcode(formulaId) {
    const field = formulaFormField("markdownDerivation");
    const marker = `{{formula-ref:${formulaId}}}`;
    if (!field || !field.value.includes(marker)) return;
    field.value = field.value
      .replace(marker, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    updateFormulaEditorPreview();
    setNotice("依赖短码已移除；保存公式卡后生成新的不可变修订。", "warning");
  }

  function updateFormulaEditorPreview() {
    if (formulaEditorPreview) {
      formulaEditorPreview.innerHTML = formulaLatexHtml(formulaFormField("latex")?.value || "");
    }
    if (formulaMarkdownPreview) {
      const markdown = formulaFormField("markdownDerivation")?.value || "";
      const dependencies = markdownDependencyIds()
        .map((formulaId) => formulaDependencyPreview.get(formulaId))
        .filter(Boolean);
      formulaMarkdownPreview.innerHTML = String(markdown).trim()
        ? renderMarkdown(markdown, {
            formulaDependencies: dependencies,
            formulaDependencyMode: "admin"
          })
        : '<p class="empty-state">输入 Markdown 后在这里实时预览。</p>';
    }
    renderDraftDependencyList();
  }

  function populateFormulaEditor(card = null, options = {}) {
    if (!formulaCardEditor) return;
    formulaCardEditor.hidden = false;
    formulaCardEditor.reset();
    const editing = Boolean(card);
    formulaEditorTitle.textContent = editing ? `编辑：${card.displayName}` : "新建公式卡";
    formulaFormField("displayName").value = card?.displayName || "";
    formulaFormField("moduleKey").value = card?.moduleKey || formulaCatalogState.selection.moduleKey || "";
    formulaFormField("categoryPath").value = card?.categoryPath || formulaCatalogState.selection.categoryPath || "";
    formulaFormField("purpose").value = card?.purpose || "";
    setFormulaSelectedTags(card?.tags || []);
    formulaFormField("latex").value = card?.latex || "";
    formulaFormField("markdownDerivation").value = card?.markdownDerivation || "";
    formulaFormField("revisionReason").value = "manual-save";
    formulaEditingCard = card;
    renderFormulaTechnicalInfo(card);
    const status = card?.publishStatus || "draft";
    formulaEditorStatus.textContent = editing ? formulaStatusLabel(card) : "草稿";
    formulaEditorStatus.className = `formula-status-badge is-${status}`;
    formulaPublicationHint.textContent = !editing
      ? "新卡保存后为草稿，只在 CMS 可见。"
      : status === "archived"
        ? "归档卡保留文章历史，不能新插入或公开访问；后续修订仍保持归档。"
        : status === "draft"
          ? "草稿卡可绑定草稿文章；发布文章前必须先发布公式卡。"
          : card.pendingPublication
            ? "当前修订待发布；访客仍看到上一条已发布修订。"
            : "当前修订已发布，访客页与新文章引用使用此版本。";
    formulaPublishButton.hidden =
      !editing || status === "archived" || (status === "published" && !card.pendingPublication);
    formulaPublishButton.textContent = status === "published" ? "发布当前修订" : "发布公式卡";
    formulaVisitorPreview.hidden = !editing || status !== "published";
    formulaVisitorPreview.href = editing ? `/derive.html?formula=${encodeURIComponent(card.slug)}` : "/derive.html";
    renderFormulaRevisions(card?.revisions || []);
    renderFormulaDerivation(card);
    renderFormulaClassificationOptions();
    updateFormulaEditorPreview();
    if (options.scroll !== false) formulaCardEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function editFormulaCard(id) {
    const result = await request(`/api/admin/formulas/${encodeURIComponent(id)}`);
    populateFormulaEditor(result.card);
  }

  function closeFormulaEditor() {
    if (formulaCardEditor) formulaCardEditor.hidden = true;
    renderFormulaTechnicalInfo();
    formulaAdminGraphInstance?.destroy();
    formulaAdminGraphInstance = null;
    formulaDependencyPreview.clear();
    formulaEditingCard = null;
  }

  async function saveFormulaEditor(operation = null) {
    const tags = String(formulaFormField("tags")?.value || "")
      .split(/[\n,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const moduleKey = String(formulaFormField("moduleKey")?.value || "").trim();
    const categoryPath = String(formulaFormField("categoryPath")?.value || "").trim();
    if (!formulaClassifications.some((item) => item.kind === "module" && item.slug === moduleKey)) {
      throw new Error("所属模块尚未登记。请搜索已有模块，或点击“新建”明确创建。");
    }
    if (
      !formulaClassifications.some(
        (item) =>
          item.kind === "category" &&
          item.parentSlug === moduleKey &&
          formulaClassificationNameKey(item.displayName) === formulaClassificationNameKey(categoryPath)
      )
    ) {
      throw new Error("主分类尚未登记。请搜索已有分类，或点击“新建”明确创建。");
    }
    const unregisteredTag = tags.find(
      (tag) =>
        !formulaClassifications.some(
          (item) => item.kind === "tag" && formulaClassificationNameKey(item.displayName) === formulaClassificationNameKey(tag)
        )
    );
    if (unregisteredTag) throw new Error(`标签 ${unregisteredTag} 尚未登记，请通过标签输入框点击“添加”。`);
    const payload = {
      displayName: formulaFormField("displayName")?.value,
      moduleKey,
      categoryPath,
      purpose: formulaFormField("purpose")?.value,
      tags,
      latex: formulaFormField("latex")?.value,
      markdownDerivation: formulaFormField("markdownDerivation")?.value,
      revisionReason: formulaFormField("revisionReason")?.value || "manual-save"
    };
    const editingId = formulaEditingCard?.formulaId || "";
    const endpoint = editingId
      ? `/api/admin/formulas/${encodeURIComponent(editingId)}`
      : "/api/admin/formulas";
    const result = await request(endpoint, {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    formulaCatalogState.selection.moduleKey = result.card.moduleKey;
    formulaCatalogState.selection.categoryPath = result.card.categoryPath;
    formulaCatalogState.pagination.page = 1;
    populateFormulaEditor(result.card);
    await loadFormulaCatalog({ selectDefault: false });
    await loadServerContent();
    renderFormulaDecisions();
    renderList();
    const message = result.decisionCount
      ? `公式卡已保存，并为 ${result.decisionCount} 篇引用文章生成黄色待决策事项。`
      : result.revisionCreated
        ? result.card.pendingPublication
          ? "公式卡已保存，并生成待发布的不可变修订；访客仍看到上一发布版本。"
          : "公式卡已保存，并生成新的不可变修订。"
        : "公式卡元数据已保存，LaTeX 与 Markdown 未变更；未生成文章待决策事项。";
    if (operation) setOperationNotice(operation, message, result.decisionCount ? "warning" : "success");
    else setNotice(message, result.decisionCount ? "warning" : "success", { key: "formula-save" });
  }

  async function mutateFormulaCard(id, action, operation = null) {
    const result = await request(`/api/admin/formulas/${encodeURIComponent(id)}/${action}`, { method: "POST", body: "{}" });
    closeFormulaEditor();
    await loadFormulaCatalog({ selectDefault: false });
    await loadServerContent();
    renderFormulaDecisions();
    renderList();
    const decisionCount = Number(result.card?.decisionCount || 0);
    const message = action === "publish"
      ? result.card?.pendingPublication
        ? "公式发布未切换，请刷新后重试。"
        : "公式卡当前修订已发布。"
      : action === "archive"
        ? decisionCount
          ? `公式卡已归档；${decisionCount} 篇引用文章继续显示原修订，并出现黄色待决策事项。`
          : "公式卡已归档，修订历史已保留。"
        : "公式卡已恢复。";
    const type = result.card?.pendingPublication && action === "publish" ? "error" : decisionCount ? "warning" : "success";
    if (operation) setOperationNotice(operation, message, type, { persistent: type === "error" });
    else setNotice(message, type, { key: `formula-${action}`, persistent: type === "error" });
  }

  async function archiveFormulaCardWithImpact(id) {
    const detail = await request(`/api/admin/formulas/${encodeURIComponent(id)}`);
    const card = detail.card;
    const incomingCount = card.derivation?.incoming?.length || 0;
    const hasNext = Boolean(card.derivation?.next);
    const relationText =
      incomingCount || hasNext
        ? `此卡位于推导链中：有 ${incomingCount} 个上一阶来源${hasNext ? "，并有 1 个下一阶" : ""}。归档后关系历史保留，访客会看到明确的链路中断。`
        : "此卡当前没有推导关系。";
    if (!window.confirm(`确认归档《${card.displayName}》吗？${relationText} 修订记录仍保留。`)) return;
    await mutateFormulaCard(card.formulaId, "archive");
  }

  function formulaSnapshotName() {
    return `formula-catalog-before-import-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}.json`;
  }

  async function importFormulaCatalogFile() {
    const file = formulaImportFile?.files?.[0];
    if (!file) throw new Error("请先选择公式目录 JSON 文件");
    const catalog = JSON.parse(await file.text());
    const result = await request("/api/admin/formulas/import", {
      method: "POST",
      body: JSON.stringify({ catalog, snapshotName: formulaSnapshotName() })
    });
    formulaCatalogState.selection.moduleKey = "";
    formulaCatalogState.selection.categoryPath = "";
    formulaCatalogState.pagination.page = 1;
    await loadFormulaCatalog();
    await loadServerContent();
    renderFormulaDecisions();
    renderList();
    setNotice(
      `已先生成本地快照 ${result.snapshotName}，再导入 ${result.importedCards} 张公式卡；新增 ${result.decisionsCreated || 0} 项文章版本决策。`,
      result.decisionsCreated ? "warning" : "success"
    );
  }

  async function exportFormulaCatalogFile() {
    const data = await request("/api/admin/formulas/export");
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "larkix-formula-catalog.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`已导出 ${data.cards?.length || 0} 张公式卡。`, "success");
  }

  function currentAdminView() {
    const view = (window.location.hash || "#editor").replace("#", "");
    return ["editor", "library", "knowledge", "formulas", "carousel", "layout", "health"].includes(view) ? view : "editor";
  }

  function setAdminView(view = currentAdminView()) {
    adminViews.forEach((section) => {
      section.hidden = section.dataset.adminView !== view;
    });
    adminNavLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.adminNav === view);
    });
    if (view === "health") loadHealth().catch(() => renderHealth(null));
    if (view === "editor") renderRecentContent();
    if (view === "knowledge") renderKnowledgeNodeList();
    if (view === "formulas" && !formulaCatalogState.loaded) {
      loadFormulaCatalog().catch((error) => setNotice(error.message, "error"));
    }
    if (view === "formulas" && !formulaRelationRepairState.loaded) {
      loadFormulaRelationRepairs().catch((error) => setNotice(error.message, "error"));
    }
    if (view === "carousel") renderFeaturedSlots();
    if (view === "layout") renderLayoutPanel();
    if (returnToArticleFormulaButton) {
      returnToArticleFormulaButton.hidden = view !== "formulas" || !formulaWorkbenchReturnState;
    }
    syncFormulaDrawerAvailability();
    syncArticlePublishDock();
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector("button[type='submit']");
    const data = new FormData(loginForm);
    const username = data.get("username");
    const password = data.get("password");
    withBusy(submitButton, "登录中...", async () => {
      try {
        const login = await request("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
        csrfToken = login.csrfToken || csrfToken;
        await loadServerContent();
        await loadImages();
        await loadHealth().catch(() => {});
        setNotice("");
        saveLogin(username);
        setLoggedIn(true);
        renderList(); renderRecentContent();
        setAdminView();
        restoreDraftIfNeeded();
      } catch (error) {
        loginNotice.textContent = error.message;
      }
    });
  });

  loginForm.password.addEventListener("focus", updatePasswordActive);
  loginForm.password.addEventListener("blur", updatePasswordActive);
  loginForm.password.addEventListener("input", updatePasswordActive);

  passwordToggle.addEventListener("click", () => {
    setPasswordVisible(loginForm.password.type === "password");
    loginForm.password.focus();
    updatePasswordActive();
  });

  sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(!dashboard.classList.contains("is-sidebar-collapsed"));
  });

  editorDockToggle.addEventListener("click", () => {
    setEditorDockCollapsed(!editorDock.classList.contains("is-collapsed"));
  });

  editorDockHandle.addEventListener("click", () => {
    setEditorDockCollapsed(!editorDock.classList.contains("is-collapsed"));
  });

  articlePublishDockCollapse?.addEventListener("click", () => {
    setArticlePublishDockCollapsed(true);
    articlePublishDockExpand?.focus();
  });

  articlePublishDockExpand?.addEventListener("click", () => {
    setArticlePublishDockCollapsed(false);
    articleSaveDraftButton?.focus();
  });

  articleSaveDraftButton?.addEventListener("click", () => requestArticleAction("draft"));
  articlePublishButton?.addEventListener("click", () => requestArticleAction("publish"));

  cmsToastRegion?.addEventListener("click", (event) => {
    const closeButton = event.target.closest(".cms-toast-close");
    if (!closeButton) return;
    const toast = closeButton.closest("[data-toast-key]");
    if (toast) dismissToast(toast.dataset.toastKey);
  });

  contentForm.addEventListener("invalid", (event) => {
    pendingArticleAction = "";
    syncArticlePublishDock();
    setNotice(`请检查“${event.target.closest("label")?.firstChild?.textContent?.trim() || "必填字段"}”后再继续。`, "error", {
      key: "article-validation",
      persistent: true
    });
  }, true);

  window.visualViewport?.addEventListener("resize", syncVisualViewportOffset);
  window.visualViewport?.addEventListener("scroll", syncVisualViewportOffset);

  focusModeToggle?.addEventListener("change", () => {
    const enabled = focusModeToggle.checked;
    focusModeToggle.setAttribute("aria-checked", String(enabled));
    if (focusModeGateState) {
      focusModeGateState.textContent = enabled
        ? "待保存：将只显示电子基础、公式推导和开源项目。"
        : "待保存：正文恢复原可见性；轮播缓冲项不会自动恢复。";
    }
    if (focusModeGateWarning) {
      focusModeGateWarning.textContent = enabled
        ? "重新开启会把活跃越界轮播项移入持久缓冲区，不会删除内容或改变发布状态。"
        : "高影响操作：非聚焦正文会恢复公开；轮播缓冲仍需由 Owner 明确选择槽位恢复。";
    }
    if (saveFocusModeButton) {
      saveFocusModeButton.disabled = focusModeToggle.dataset.savedValue === String(enabled);
    }
  });

  saveFocusModeButton?.addEventListener("click", () => {
    withBusy(saveFocusModeButton, "保存中...", saveFocusMode).catch((error) => setNotice(error.message, "error"));
  });

  logoutButton.addEventListener("click", () => {
    if (!confirmDiscard("当前有未保存修改，退出登录会保留本地草稿但不会写入数据库，确认退出吗？")) return;
    withBusy(logoutButton, "退出中...", async () => {
      await request("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
      csrfToken = "";
      setLoggedIn(false);
      setNotice("");
    });
  });

  exportButton.addEventListener("click", () => {
    withBusy(exportButton, "导出中...", async () => {
      try {
        const data = await request("/api/admin/export");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `larkixmaker-content-${data.site?.versionLabel || "export"}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setNotice("内容导出已生成。", "success");
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });

  resetButton.addEventListener("click", () => {
    if (!confirmDiscard("当前有未保存修改，新建空白会清空编辑器，确认继续吗？")) return;
    resetForm({ clearLocalDraft: true });
    setNotice("已切换为新建空白内容。", "info");
  });

  discardDraftButton.addEventListener("click", () => {
    if (!window.confirm("确认丢弃本地草稿吗？数据库中已保存的内容不会受影响。")) return;
    clearDraft();
    markClean();
    setNotice("本地草稿已丢弃。", "success");
  });

  refreshImagesButton.addEventListener("click", () => {
    withBusy(refreshImagesButton, "刷新中...", async () => {
      try {
        await loadImages();
        setNotice("图片库已刷新。", "success");
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });

  refreshHealthButton.addEventListener("click", () => {
    withBusy(refreshHealthButton, "刷新中...", async () => {
      try {
        await loadHealth();
        setNotice("系统状态已刷新。", "success");
      } catch (error) {
        renderHealth(null);
        setNotice(error.message, "error");
      }
    });
  });

  contentSearch.addEventListener("input", () => {
    filters.search = contentSearch.value;
    renderList(); renderRecentContent();
  });

  typeFilter.addEventListener("change", () => {
    filters.type = typeFilter.value;
    renderList(); renderRecentContent();
  });

  statusFilter.addEventListener("change", () => {
    filters.status = statusFilter.value;
    renderList(); renderRecentContent();
  });

  clearFiltersButton.addEventListener("click", () => {
    filters.search = "";
    filters.type = "all";
    filters.status = "all";
    contentSearch.value = "";
    typeFilter.value = "all";
    statusFilter.value = "all";
    renderList(); renderRecentContent();
  });

  selectAllContent.addEventListener("change", () => {
    const items = filteredItems();
    if (selectAllContent.checked) {
      items.forEach((item) => selectedContent.add(itemKey(item)));
    } else {
      items.forEach((item) => selectedContent.delete(itemKey(item)));
    }
    renderList(); renderRecentContent();
  });

  bulkPublishButton.addEventListener("click", () => {
    runBulkAction("publish", bulkPublishButton, "发布中...", "确认发布已选择的 {count} 项内容吗？").catch((error) => setNotice(error.message, "error"));
  });

  bulkDraftButton.addEventListener("click", () => {
    runBulkAction("draft", bulkDraftButton, "转草稿中...", "确认将已选择的 {count} 项内容转为草稿吗？").catch((error) => setNotice(error.message, "error"));
  });

  bulkDeleteButton.addEventListener("click", () => {
    runBulkAction("delete", bulkDeleteButton, "回收中...", "确认将已选择的 {count} 项内容移入回收站吗？").catch((error) => setNotice(error.message, "error"));
  });

  bulkRestoreButton.addEventListener("click", () => {
    runBulkAction("restore", bulkRestoreButton, "恢复中...", "确认恢复已选择的 {count} 项内容吗？").catch((error) => setNotice(error.message, "error"));
  });

  recentContentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='edit']");
    if (!button) return;
    const item = combinedItems().find((entry) => entry.contentType === button.dataset.type && entry.id === button.dataset.id);
    if (item) editItem(button.dataset.type, item).catch((error) => setNotice(error.message, "error"));
  });

  newKnowledgeNodeButton?.addEventListener("click", startNewKnowledgeNode);

  knowledgeNodeList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = knowledgeItems().find((entry) => entry.id === button.dataset.id);
    if (!item) return;
    withBusy(button, "处理中...", async () => {
      if (button.dataset.action === "edit") {
        await editItem("knowledge_node", item);
        return;
      }
      if (button.dataset.action === "publish") {
        await mutateItem(item, "publish");
        setNotice("推导节点已发布。", "success");
      }
      if (button.dataset.action === "draft") {
        await mutateItem(item, "draft");
        setNotice("推导节点已转为草稿。", "success");
      }
      if (button.dataset.action === "delete") {
        if (!window.confirm("确认将推导节点移入回收站吗？公开访问会立即隐藏。")) return;
        await mutateItem(item, "delete");
        setNotice("推导节点已移入回收站。", "success");
      }
      if (button.dataset.action === "restore") {
        await mutateItem(item, "restore");
        setNotice("推导节点已恢复。", "success");
      }
      renderList();
    }).catch((error) => setNotice(error.message, "error"));
  });

  refreshKnowledgeRevisionsButton?.addEventListener("click", () => {
    withBusy(refreshKnowledgeRevisionsButton, "刷新中...", refreshKnowledgeRevisions).catch((error) => setNotice(error.message, "error"));
  });

  knowledgeRevisionList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='restore-knowledge-revision']");
    if (!button) return;
    if (!window.confirm("确认恢复到此版本吗？当前节点会先生成恢复前快照。")) return;
    withBusy(button, "恢复中...", async () => {
      const result = await request(
        `/api/admin/knowledge-nodes/${encodeURIComponent(button.dataset.nodeId)}/revisions/${encodeURIComponent(button.dataset.revisionId)}/restore`,
        { method: "POST", body: "{}" }
      );
      serverContent = { ...serverContent, knowledgeNodes: result.nodes || [] };
      applyItemToForm("knowledge_node", result.node, { confirm: false });
      renderKnowledgeRevisions(result.revisions || [], result.node);
      setKnowledgeWarnings(result.warnings || []);
      renderList();
      setNotice("推导节点已恢复到选定版本。", "success");
    }).catch((error) => setNotice(error.message, "error"));
  });

  featuredSlots?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const item = combinedItems().find((entry) => entry.contentType === button.dataset.type && entry.id === button.dataset.id);
    if (action === "edit-featured" && item) {
      applyItemToForm(button.dataset.type, item);
      return;
    }
    if (action === "assign-featured-slot") {
      assignCurrentToFeaturedSlot(button.dataset.slot);
      return;
    }
    if (action === "clear-featured-slot" && item) {
      if (!window.confirm(`确认将《${item.title || "未命名内容"}》移出首页轮播吗？\n\n本操作只会取消首页推荐并释放槽位，不会删除文章或项目正文。`)) return;
      withBusy(button, "取消中...", async () => {
        await saveItemFeatured(item, false, item.featuredOrder);
        renderList();
        renderRecentContent();
        renderFeaturedSlots();
        setNotice("已取消首页轮播并释放槽位，文章或项目正文仍完整保留。", "success");
      }).catch((error) => setNotice(error.message, "error"));
    }
  });

  carouselBufferList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest("[data-buffer-id]");
    const bufferId = card?.dataset.bufferId;
    const item = (serverContent.carousel?.buffered || []).find((entry) => entry.bufferId === bufferId);
    if (!item) {
      setNotice("轮播缓冲项已变化，请刷新后重试。", "error");
      return;
    }
    if (button.dataset.action === "restore-carousel-buffer") {
      const slot = Number(card.querySelector("[data-carousel-restore-slot]")?.value);
      if (!Number.isInteger(slot) || slot < 0 || slot >= featuredLimit) {
        setNotice("请明确选择 0-3 的恢复槽位。", "error");
        return;
      }
      if (!window.confirm(`确认把《${item.displayTitle || item.contentTitle || item.contentId}》恢复到轮播槽位 ${slot} 吗？槽位冲突时不会自动重排。`)) {
        return;
      }
      withBusy(button, "恢复中...", async () => {
        const result = await request(
          `/api/admin/carousel-buffer/${encodeURIComponent(bufferId)}/restore`,
          { method: "POST", body: JSON.stringify({ slot }) }
        );
        serverContent.carousel = result.carousel || serverContent.carousel;
        await loadServerContent();
        renderList();
        renderRecentContent();
        renderFeaturedSlots();
        setNotice(`已手动恢复到轮播槽位 ${slot}；正文与发布状态保持不变。`, "success");
      }).catch((error) => setNotice(error.message, "error"));
      return;
    }
    if (button.dataset.action === "remove-carousel-buffer") {
      if (!window.confirm(`确认移除《${item.displayTitle || item.contentTitle || item.contentId}》的缓冲记录吗？本操作不会删除关联正文。`)) {
        return;
      }
      withBusy(button, "移除中...", async () => {
        const result = await request(`/api/admin/carousel-buffer/${encodeURIComponent(bufferId)}`, {
          method: "DELETE"
        });
        serverContent.carousel = result.carousel || serverContent.carousel;
        renderCarouselBuffer();
        setNotice("已移除失效缓冲记录；未删除任何正文。", "success");
      }).catch((error) => setNotice(error.message, "error"));
    }
  });

  layoutPanel?.addEventListener("click", (event) => {
    const resizeButton = event.target.closest("[data-layout-resize]");
    if (resizeButton) {
      event.preventDefault();
      const tile = resizeButton.closest(".layout-snapshot-tile");
      resizeLayoutSection(tile?.dataset.layoutPage, tile?.dataset.layoutKey);
      setNotice("模块大小已调整，点击保存后写入网站状态。", "warning");
      return;
    }
    const moveButton = event.target.closest("[data-layout-move]");
    if (moveButton) {
      const row = moveButton.closest("[data-layout-page][data-layout-key]");
      moveLayoutSection(row?.dataset.layoutPage, row?.dataset.layoutKey, Number(moveButton.dataset.layoutMove));
      setNotice("排布顺序已调整，点击保存后写入网站状态。", "warning");
      return;
    }
    const saveButton = event.target.closest("#layoutSaveButton");
    if (saveButton) {
      saveLayoutPanel(saveButton).catch((error) => setNotice(error.message, "error"));
      return;
    }
    const resetButton = event.target.closest("#layoutResetButton");
    if (resetButton) {
      serverContent.siteLayout = Object.fromEntries(defaultLayoutPages.map((page) => [page.key, page.sections.map((item) => ({ ...item }))]));
      renderLayoutPanel();
      setNotice("已恢复默认排布，保存后会写入网站状态。", "info");
    }
  });

  layoutPanel?.addEventListener("change", (event) => {
    if (!event.target.matches("[name='layoutOrder'], [name='layoutVisible'], [name='layoutSize']")) return;
    const layout = readLayoutPanel();
    Object.entries(layout).forEach(([pageKey, rows]) => {
      layout[pageKey] = sortedLayoutSections(rows).map((row, index) => ({ ...row, order: index + 1 }));
    });
    serverContent.siteLayout = layout;
    renderLayoutPanel();
    setNotice("页面快照已更新，点击保存后写入网站状态。", "warning");
  });

  layoutPanel?.addEventListener("dragstart", (event) => {
    if (event.target.closest("[data-layout-resize]")) {
      event.preventDefault();
      return;
    }
    const tile = event.target.closest(".layout-snapshot-tile");
    if (!tile) return;
    layoutDragState = { page: tile.dataset.layoutPage, key: tile.dataset.layoutKey };
    tile.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${layoutDragState.page}:${layoutDragState.key}`);
  });

  layoutPanel?.addEventListener("dragover", (event) => {
    const tile = event.target.closest(".layout-snapshot-tile");
    if (!tile || !layoutDragState || tile.dataset.layoutPage !== layoutDragState.page) return;
    event.preventDefault();
    tile.classList.add("is-drag-over");
  });

  layoutPanel?.addEventListener("dragleave", (event) => {
    event.target.closest(".layout-snapshot-tile")?.classList.remove("is-drag-over");
  });

  layoutPanel?.addEventListener("drop", (event) => {
    const tile = event.target.closest(".layout-snapshot-tile");
    if (!tile || !layoutDragState || tile.dataset.layoutPage !== layoutDragState.page) return;
    event.preventDefault();
    reorderLayoutSection(layoutDragState.page, layoutDragState.key, tile.dataset.layoutKey);
    layoutDragState = null;
    setNotice("快照顺序已调整，点击保存后写入网站状态。", "warning");
  });

  layoutPanel?.addEventListener("dragend", () => {
    layoutDragState = null;
    layoutPanel.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => item.classList.remove("is-dragging", "is-drag-over"));
  });

  formulaCategoryTree?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module][data-category]");
    if (!button) return;
    formulaCatalogState.selection.moduleKey = button.dataset.module;
    formulaCatalogState.selection.categoryPath = button.dataset.category;
    formulaCatalogState.pagination.page = 1;
    loadFormulaCatalog({ selectDefault: false }).catch((error) => setNotice(error.message, "error"));
  });

  formulaSearchInput?.addEventListener("input", () => {
    window.clearTimeout(formulaSearchTimer);
    formulaSearchTimer = window.setTimeout(() => {
      formulaCatalogState.selection.query = formulaSearchInput.value.trim();
      formulaCatalogState.pagination.page = 1;
      loadFormulaCatalog({ selectDefault: false }).catch((error) => setNotice(error.message, "error"));
    }, 260);
  });

  formulaTagFilter?.addEventListener("change", () => {
    formulaCatalogState.selection.tag = formulaTagFilter.value;
    formulaCatalogState.pagination.page = 1;
    loadFormulaCatalog({ selectDefault: false }).catch((error) => setNotice(error.message, "error"));
  });

  formulaArchiveFilter?.addEventListener("change", () => {
    formulaCatalogState.selection.publishStatus = formulaArchiveFilter.value;
    formulaCatalogState.selection.archiveState = "all";
    formulaCatalogState.pagination.page = 1;
    loadFormulaCatalog({ selectDefault: false }).catch((error) => setNotice(error.message, "error"));
  });

  formulaPreviousPage?.addEventListener("click", () => {
    formulaCatalogState.pagination.page = Math.max(1, formulaCatalogState.pagination.page - 1);
    loadFormulaCatalog({ selectDefault: false }).catch((error) => setNotice(error.message, "error"));
  });

  formulaNextPage?.addEventListener("click", () => {
    formulaCatalogState.pagination.page += 1;
    loadFormulaCatalog({ selectDefault: false }).catch((error) => setNotice(error.message, "error"));
  });

  formulaCardList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-formula-action]");
    if (!button) return;
    const action = button.dataset.formulaAction;
    const id = button.dataset.formulaId;
    if (action === "edit") {
      withBusy(button, "加载中...", () => editFormulaCard(id)).catch((error) => setNotice(error.message, "error"));
      return;
    }
    if (action === "archive") {
      withBusy(button, "检查链路...", () => archiveFormulaCardWithImpact(id)).catch((error) => setNotice(error.message, "error"));
      return;
    }
    withBusy(button, "处理中...", () => mutateFormulaCard(id, action)).catch((error) => setNotice(error.message, "error"));
  });

  formulaRepairStatus?.addEventListener("change", () => {
    formulaRelationRepairState.status = formulaRepairStatus.value;
    loadFormulaRelationRepairs().catch((error) => setNotice(error.message, "error"));
  });
  formulaRepairIssue?.addEventListener("change", () => {
    formulaRelationRepairState.issueCode = formulaRepairIssue.value;
    loadFormulaRelationRepairs().catch((error) => setNotice(error.message, "error"));
  });
  formulaRepairRefresh?.addEventListener("click", () => {
    withBusy(formulaRepairRefresh, "刷新中...", loadFormulaRelationRepairs).catch((error) =>
      setNotice(error.message, "error")
    );
  });
  formulaRepairList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-formula-repair-action]");
    if (!button) return;
    const container = button.closest("[data-formula-repair-id]");
    if (!container) return;
    const action = button.dataset.formulaRepairAction;
    if (action === "open-source") {
      withBusy(button, "加载中...", () => editFormulaCard(button.dataset.formulaId)).catch((error) =>
        setNotice(error.message, "error")
      );
      return;
    }
    withBusy(button, "校验中...", () =>
      appendFormulaRelationRepairEvent(container.dataset.formulaRepairId, action, container)
    ).catch((error) => setNotice(error.message, "error"));
  });

  newFormulaButton?.addEventListener("click", () => populateFormulaEditor());
  formulaEditorCancel?.addEventListener("click", closeFormulaEditor);
  formulaPublishButton?.addEventListener("click", () => {
    if (!formulaEditingCard) return;
    const operation = beginFeedbackOperation("formula-publish");
    withBusy(formulaPublishButton, "发布中...", () =>
      mutateFormulaCard(formulaEditingCard.formulaId, "publish", operation)
    ).catch((error) => setOperationNotice(operation, error.message, "error", { persistent: true }));
  });
  formulaClassificationKind?.addEventListener("change", renderFormulaClassificationManager);
  formulaClassificationParent?.addEventListener("input", () => {
    renderFormulaClassificationOptions();
  });
  formulaClassificationCreate?.addEventListener("click", () => {
    withBusy(formulaClassificationCreate, "新建中...", createFormulaClassificationFromManager).catch((error) =>
      setNotice(error.message, "error")
    );
  });
  formulaTagAddButton?.addEventListener("click", () => {
    withBusy(formulaTagAddButton, "添加中...", addFormulaSelectedTag).catch((error) => setNotice(error.message, "error"));
  });
  formulaTagPicker?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addFormulaSelectedTag().catch((error) => setNotice(error.message, "error"));
  });
  formulaSelectedTags?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-formula-remove-tag]");
    if (!button) return;
    setFormulaSelectedTags(formulaSelectedTagValues().filter((tag) => tag !== button.dataset.formulaRemoveTag));
  });
  formulaCardEditor?.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-formula-copy]");
    if (copyButton) {
      copyFormulaTechnicalValue(copyButton.dataset.formulaCopy);
      return;
    }
    const createButton = event.target.closest("[data-formula-create-classification]");
    if (!createButton) return;
    withBusy(createButton, "新建中...", () =>
      createFormulaClassificationFromEditor(createButton.dataset.formulaCreateClassification)
    ).catch((error) => setNotice(error.message, "error"));
  });
  document.querySelectorAll(".formula-field-help-button").forEach((button) => {
    button.addEventListener("pointerenter", () => showFormulaFieldHelp(button));
    button.addEventListener("pointerleave", () => {
      if (button.getAttribute("aria-expanded") !== "true") hideFormulaFieldHelp(button);
    });
    button.addEventListener("focus", () => showFormulaFieldHelp(button));
    button.addEventListener("blur", () => {
      if (button.getAttribute("aria-expanded") !== "true") hideFormulaFieldHelp(button);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const expanded = button.getAttribute("aria-expanded") === "true";
      if (expanded) hideFormulaFieldHelp(button);
      else showFormulaFieldHelp(button, true);
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".formula-field-help-button, #formulaFieldHelpPopover")) hideFormulaFieldHelp();
  });
  formulaNextTarget?.addEventListener("input", () => scheduleFormulaDerivationCandidates(formulaNextTarget.value));
  formulaNextSet?.addEventListener("click", () => {
    withBusy(formulaNextSet, "插入中...", insertFormulaDependencyShortcode).catch((error) =>
      setNotice(error.message, "error")
    );
  });
  formulaNextRelation?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-formula-dependency-remove]");
    if (!button) return;
    removeFormulaDependencyShortcode(button.dataset.formulaDependencyRemove);
  });
  formulaCardEditor?.addEventListener("input", (event) => {
    if (event.target.name === "latex" || event.target.name === "markdownDerivation") updateFormulaEditorPreview();
    if (event.target.name === "moduleKey") renderFormulaClassificationOptions();
    dismissToast("formula-save");
    dismissToast("formula-publish");
  });
  formulaCardEditor?.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = formulaCardEditor.querySelector("button[type='submit']");
    const operation = beginFeedbackOperation("formula-save");
    withBusy(submitButton, "保存中...", () => saveFormulaEditor(operation)).catch((error) =>
      setOperationNotice(operation, error.message, "error", { persistent: true })
    );
  });
  formulaImportButton?.addEventListener("click", () => {
    withBusy(formulaImportButton, "导入中...", importFormulaCatalogFile).catch((error) => setNotice(error.message, "error"));
  });
  formulaExportButton?.addEventListener("click", () => {
    withBusy(formulaExportButton, "导出中...", exportFormulaCatalogFile).catch((error) => setNotice(error.message, "error"));
  });

  openFormulaAuthoringButton?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || getType() !== "post") return;
    event.preventDefault();
    const pendingSnapshot = {
      captured: captureFormulaEditorState(),
      capturedAt: performance.now()
    };
    formulaAuthoringPointerSnapshot = pendingSnapshot;
    window.setTimeout(() => {
      if (formulaAuthoringPointerSnapshot === pendingSnapshot) formulaAuthoringPointerSnapshot = null;
    }, 1500);
  });
  openFormulaAuthoringButton?.addEventListener("click", (event) => openFormulaAuthoring(event));
  contentForm.markdown?.addEventListener("contextmenu", (event) => {
    if (event.shiftKey || getType() !== "post") return;
    event.preventDefault();
    openFormulaAuthoring(event);
  });
  formulaAuthoringClose?.addEventListener("click", () => closeFormulaAuthoring());
  formulaAuthoringWorkbenchButton?.addEventListener("click", openFormulaWorkbenchFromArticle);
  returnToArticleFormulaButton?.addEventListener("click", returnToArticleFormula);
  formulaExistingTab?.addEventListener("click", () => setFormulaAuthoringTab("existing"));
  formulaCreateTab?.addEventListener("click", () => {
    if (formulaAuthoringState.selectionInfo) setFormulaAuthoringTab("create");
  });
  formulaCreateModule?.addEventListener("input", renderFormulaClassificationOptions);
  formulaCreateModuleButton?.addEventListener("click", () => {
    withBusy(formulaCreateModuleButton, "新增中...", () =>
      createFormulaSelectionClassification("module")
    ).catch((error) => setNotice(error.message, "error"));
  });
  formulaCreateCategoryButton?.addEventListener("click", () => {
    withBusy(formulaCreateCategoryButton, "新增中...", () =>
      createFormulaSelectionClassification("category")
    ).catch((error) => setNotice(error.message, "error"));
  });
  formulaCreateTagAddButton?.addEventListener("click", () => {
    withBusy(formulaCreateTagAddButton, "添加中...", addFormulaCreateTag).catch((error) =>
      setNotice(error.message, "error")
    );
  });
  formulaCreateTagPicker?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addFormulaCreateTag().catch((error) => setNotice(error.message, "error"));
  });
  formulaCreateSelectedTags?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-formula-create-remove-tag]");
    if (!button) return;
    const removeKey = formulaClassificationNameKey(
      button.dataset.formulaCreateRemoveTag
    );
    setFormulaCreateTags(
      formulaCreateTagValues().filter(
        (tag) => formulaClassificationNameKey(tag) !== removeKey
      )
    );
  });
  formulaAuthoringModule?.addEventListener("change", () => {
    formulaAuthoringState.moduleKey = formulaAuthoringModule.value;
    formulaAuthoringState.categoryPath = "";
    formulaAuthoringState.page = 1;
    loadFormulaAuthoringCatalog().catch((error) => setNotice(error.message, "error"));
  });
  formulaAuthoringCategory?.addEventListener("change", () => {
    formulaAuthoringState.categoryPath = formulaAuthoringCategory.value;
    const selectedOption = formulaAuthoringCategory.selectedOptions?.[0];
    if (formulaAuthoringState.categoryPath && selectedOption?.dataset.module) {
      formulaAuthoringState.moduleKey = selectedOption.dataset.module;
    }
    formulaAuthoringState.page = 1;
    loadFormulaAuthoringCatalog().catch((error) => setNotice(error.message, "error"));
  });
  formulaAuthoringTag?.addEventListener("change", () => {
    formulaAuthoringState.tag = formulaAuthoringTag.value;
    formulaAuthoringState.page = 1;
    loadFormulaAuthoringCatalog().catch((error) => setNotice(error.message, "error"));
  });
  formulaAuthoringQuery?.addEventListener("input", () => {
    window.clearTimeout(formulaAuthoringSearchTimer);
    formulaAuthoringSearchTimer = window.setTimeout(() => {
      formulaAuthoringState.query = formulaAuthoringQuery.value.trim();
      formulaAuthoringState.page = 1;
      loadFormulaAuthoringCatalog().catch((error) => setNotice(error.message, "error"));
    }, 260);
  });
  formulaAuthoringPrevious?.addEventListener("click", () => {
    formulaAuthoringState.page = Math.max(1, formulaAuthoringState.page - 1);
    loadFormulaAuthoringCatalog().catch((error) => setNotice(error.message, "error"));
  });
  formulaAuthoringNext?.addEventListener("click", () => {
    formulaAuthoringState.page += 1;
    loadFormulaAuthoringCatalog().catch((error) => setNotice(error.message, "error"));
  });
  formulaAuthoringResults?.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-formula-preview]");
    if (previewButton) {
      const card = formulaAuthoringState.items.find((item) => item.formulaId === previewButton.dataset.formulaPreview);
      if (card) renderFormulaAuthoringQuickPreview(card);
      return;
    }
    const button = event.target.closest("[data-formula-bind]");
    if (!button || button.disabled) return;
    const card = formulaAuthoringState.items.find((item) => item.formulaId === button.dataset.formulaBind);
    if (!card) return;
    try {
      insertExistingFormulaBinding(card, button.dataset.bindMode);
    } catch (error) {
      setNotice(error.message, "error");
    }
  });
  formulaCreateAndBindButton?.addEventListener("click", () => {
    withBusy(formulaCreateAndBindButton, "创建并保存中...", createFormulaCardFromSelection).catch((error) => {
      saveDraft();
      setNotice(`${error.message}。公式未创建，文章原始 LaTeX 已保留。`, "error");
    });
  });
  formulaDecisionList?.addEventListener("click", (event) => {
    const cancel = event.target.closest("[data-formula-decision-cancel-clone]");
    if (cancel) {
      formulaDecisionCloneId = "";
      renderFormulaDecisions();
      return;
    }
    const submitClone = event.target.closest("[data-formula-decision-submit-clone]");
    if (submitClone) {
      const decisionId = submitClone.dataset.formulaDecisionSubmitClone;
      const container = formulaDecisionList.querySelector(`[data-formula-decision-clone-form="${CSS.escape(decisionId)}"]`);
      const displayName = container?.querySelector("[name='displayName']")?.value.trim();
      const moduleKey = container?.querySelector("[name='moduleKey']")?.value.trim();
      const categoryPath = container?.querySelector("[name='categoryPath']")?.value.trim();
      const latex = container?.querySelector("[name='latex']")?.value.trim();
      if (!displayName || !moduleKey || !categoryPath || !latex) {
        setNotice("另建公式卡必须填写名称、所属模块、自定义分类和 LaTeX。", "error");
        return;
      }
      const formula = {
        displayName,
        moduleKey,
        categoryPath,
        purpose: container.querySelector("[name='purpose']")?.value.trim() || "",
        tags: String(container.querySelector("[name='tags']")?.value || "")
          .split(/[\n,，、]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        latex,
        markdownDerivation: container.querySelector("[name='markdownDerivation']")?.value || ""
      };
      withBusy(submitClone, "创建并绑定中...", () => resolveFormulaDecision(decisionId, "clone", formula)).catch((error) =>
        setNotice(error.message, "error")
      );
      return;
    }
    const actionButton = event.target.closest("[data-formula-decision-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.formulaDecisionAction;
    const decisionId = actionButton.dataset.decisionId;
    if (action === "clone") {
      formulaDecisionCloneId = decisionId;
      renderFormulaDecisions();
      return;
    }
    const prompt =
      action === "keep"
        ? "确认仅为当前文章保留原公式版本吗？其他文章不会受影响。"
        : "确认仅让当前文章采用公式卡最新版吗？其他文章不会受影响。";
    if (!window.confirm(prompt)) return;
    withBusy(actionButton, "处理中...", () => resolveFormulaDecision(decisionId, action)).catch((error) =>
      setNotice(error.message, "error")
    );
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && formulaAuthoringState.expanded) {
      event.preventDefault();
      closeFormulaAuthoring();
    }
  });

  window.addEventListener("hashchange", () => setAdminView());

  contentForm.addEventListener("input", (event) => {
    if (event.target.closest("#formulaDecisionPanel")) return;
    if (!contentForm.querySelector(":invalid")) dismissToast("article-validation");
    markDirty();
    updatePreview();
    updateVisibilityHint();
    renderFeaturedSlots();
  });

  contentForm.addEventListener("change", (event) => {
    if (event.target.closest("#formulaDecisionPanel")) return;
    if (!contentForm.querySelector(":invalid")) dismissToast("article-validation");
    if (event.target.name === "type") updateTypeFields();
    if (event.target.name === "featuredOrder") {
      event.target.value = String(featuredOrderValue(event.target.value));
    }
    if (event.target.name === "recommendationPriority") {
      event.target.value = String(recommendationPriorityValue(event.target.value));
    }
    markDirty();
    updateVisibilityHint();
    renderFeaturedSlots();
  });

  imageLibrary.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cover]");
    if (!button) return;
    if (getType() === "post") {
      try {
        await openCoverCrop({ cover: button.dataset.cover });
      } catch (error) {
        setNotice(error.message, "error");
        return;
      }
    } else {
      setCover(button.dataset.cover, "已从图片库选择原图");
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(button.dataset.cover).catch(() => {});
    }
    setNotice(getType() === "post" ? "已打开文章封面取景框。" : "已选择原图，并复制图片路径。", "success");
  });

  insertInlineFormulaButton?.addEventListener("click", () => insertFormula("inline"));

  insertDisplayFormulaButton?.addEventListener("click", () => insertFormula("display"));

  insertFormulaSnippetButton?.addEventListener("click", insertFormulaSnippet);

  insertDeriveLinkButton?.addEventListener("click", insertDeriveShortcode);

  applyBoostTemplateButton?.addEventListener("click", applyBoostTemplate);

  insertBoostChainButton?.addEventListener("click", () => {
    insertMarkdownText(boostChainMarkdown(), { block: true });
    setNotice("已插入 BOOST 电感选型计算书公式推导入口。", "success");
  });

  markdownFile.addEventListener("change", async () => {
    const file = markdownFile.files[0];
    if (!file) return;
    contentForm.markdown.value = await file.text();
    if (!contentForm.title.value) contentForm.title.value = file.name.replace(/\.md$/i, "");
    if (markdownHint) markdownHint.textContent = `已导入：${file.name}`;
    updatePreview();
    markDirty();
  });

  coverFile.addEventListener("change", () => {
    const file = coverFile.files[0];
    if (!file) return;
    withBusy(coverFile, "", async () => {
      try {
        coverHint.textContent = `读取原图：${file.name}`;
        if (getType() === "post") {
          await openCoverCrop({ file });
        } else {
          const result = await uploadOriginalCover(file);
          setCover(result.url, `${file.name} 原图已上传`);
          coverFile.value = "";
          setNotice("原图上传成功，请保存内容写入数据库。", "success");
        }
      } catch (error) {
        coverHint.textContent = error.message;
        setNotice(error.message, "error");
      }
    });
  });

  coverPreview?.addEventListener("load", positionCoverPreview);
  if (typeof ResizeObserver !== "undefined" && coverPreviewShell) {
    new ResizeObserver(positionCoverPreview).observe(coverPreviewShell);
  }

  coverCropEdit?.addEventListener("click", () => {
    if (!currentCover) return;
    openCoverCrop({ cover: currentCover, crop: currentCoverCrop }).catch((error) => setNotice(error.message, "error"));
  });

  coverCropReset?.addEventListener("click", () => {
    if (!currentCover) return;
    setCover(currentCover, "已恢复完整原图，原图 URL 保持不变", { crop: null });
    setNotice("封面取景坐标已重置；保存后文章将使用完整原图。", "success");
  });

  coverCropSelection?.addEventListener("pointerdown", cropPointerDown);
  coverCropSelection?.addEventListener("pointermove", cropPointerMove);
  coverCropSelection?.addEventListener("pointerup", cropPointerEnd);
  coverCropSelection?.addEventListener("pointercancel", cropPointerEnd);
  coverCropSelection?.addEventListener("keydown", cropKeyboardMove);
  window.addEventListener("resize", layoutCoverCropSurface);

  coverCropCancel?.addEventListener("click", closeCoverCrop);

  coverCropModal?.addEventListener("click", (event) => {
    if (event.target === coverCropModal) closeCoverCrop();
  });

  coverCropModal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCoverCrop();
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...coverCropModal.querySelectorAll("button:not([disabled]), [tabindex='0']")].filter(
      (element) => element.offsetParent !== null
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  });

  coverCropApply?.addEventListener("click", () => {
    withBusy(coverCropApply, "应用中...", applyCoverCrop).catch((error) => {
      setNotice(error.message, "error");
    });
  });

  contentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const isArticle = getType() === "post";
    if (isArticle && articleOperationInFlight) {
      setNotice("当前文章操作仍在进行，请等待结果。", "warning", { key: "article-operation" });
      return;
    }
    const action = isArticle
      ? pendingArticleAction || (contentForm.publishStatus.value === "published" ? "publish" : "draft")
      : "save";
    const operation = isArticle ? beginFeedbackOperation("article-operation") : null;
    const submitButton = isArticle
      ? action === "publish" ? articlePublishButton : articleSaveDraftButton
      : nonArticleSaveButton;
    if (isArticle) {
      articleOperationInFlight = true;
      pendingArticleAction = action;
      syncArticlePublishDock();
    }
    withBusy(submitButton, action === "publish" ? "发布中..." : "保存中...", async () => {
      try {
        saveDraft();
        const { endpoint, collectionKey, payload } = buildPayload();
        validateFeaturedPayload(payload);
        const result = await request(endpoint, { method: "POST", body: JSON.stringify(payload) });
        serverContent = { ...serverContent, [collectionKey]: resultCollection(result, collectionKey) };
        if (collectionKey === "posts") await loadServerContent();
        if (collectionKey === "posts" && action === "publish") {
          await confirmPublicPostProjection(payload.id);
        }
        clearDraft();
        if (collectionKey === "knowledgeNodes") {
          applyItemToForm("knowledge_node", result.node, { confirm: false });
          const revisionResult = await request(`/api/admin/knowledge-nodes/${encodeURIComponent(result.node.id)}/revisions`).catch(() => ({ revisions: [] }));
          renderKnowledgeRevisions(revisionResult.revisions || [], result.node);
          setKnowledgeWarnings(result.warnings || []);
        } else {
          resetForm();
        }
        renderList(); renderRecentContent(); renderFeaturedSlots();
        const message = isArticle
          ? action === "publish"
            ? `文章已发布：${payload.title || "未命名内容"}。`
            : `文章草稿已保存：${payload.title || "未命名内容"}。`
          : `保存成功：${payload.title || "未命名内容"}。`;
        if (operation) setOperationNotice(operation, message, "success");
        else setNotice(message, "success");
      } catch (error) {
        saveDraft();
        markDirty();
        const message = `${error.message}。当前编辑内容已保留在本地草稿。`;
        if (operation) setOperationNotice(operation, message, "error", { persistent: true });
        else setNotice(message, "error", { persistent: true });
      }
    }).finally(() => {
      if (!isArticle) return;
      articleOperationInFlight = false;
      pendingArticleAction = "";
      syncArticlePublishDock();
    });
  });

  list.addEventListener("click", (event) => {
    const checkbox = event.target.closest("input[data-action='select']");
    if (checkbox) {
      if (checkbox.checked) selectedContent.add(checkbox.dataset.key);
      else selectedContent.delete(checkbox.dataset.key);
      updateBulkState(filteredItems());
      return;
    }

    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const type = button.dataset.type;
    const id = button.dataset.id;
    const collectionKey = collectionKeyForType(type);
    const basePath = type === "knowledge_node" ? "admin/knowledge-nodes" : type === "project" ? "projects" : "posts";

    withBusy(button, "处理中...", async () => {
      try {
        if (button.dataset.action === "edit") {
          const item = serverContent[collectionKey].find((entry) => entry.id === id);
          if (item) await editItem(type, { ...item, contentType: type });
          return;
        }
        if (button.dataset.action === "publish" || button.dataset.action === "draft") {
          const item = serverContent[collectionKey].find((entry) => entry.id === id);
          if (item) await mutateItem({ ...item, contentType: type }, button.dataset.action);
          setNotice(button.dataset.action === "publish" ? "内容已发布。" : "内容已转为草稿。", "success");
        }
        if (button.dataset.action === "delete") {
          if (!window.confirm("确认移入回收站吗？访客端将不再显示。")) return;
          const result = await request(`/api/${basePath}/${encodeURIComponent(id)}`, { method: "DELETE" });
          serverContent = { ...serverContent, [collectionKey]: resultCollection(result, collectionKey) };
          setNotice("内容已移入回收站。", "success");
        }
        if (button.dataset.action === "restore") {
          const result = await request(`/api/${basePath}/${encodeURIComponent(id)}/restore`, { method: "POST", body: "{}" });
          serverContent = { ...serverContent, [collectionKey]: resultCollection(result, collectionKey) };
          setNotice("内容已恢复。", "success");
        }
        if (button.dataset.action === "hard-delete") {
          if (type === "knowledge_node") return;
          if (!window.confirm("永久删除无法从回收站恢复，确认继续吗？")) return;
          const result = await request(`/api/${basePath}/${encodeURIComponent(id)}/hard`, { method: "DELETE" });
          serverContent = { ...serverContent, [collectionKey]: resultCollection(result, collectionKey) };
          setNotice("内容已永久删除。", "success");
        }
        renderList(); renderRecentContent();
      } catch (error) {
        setNotice(error.message, "error");
      }
    });
  });
  window.addEventListener("beforeunload", (event) => {
    if (!isDirty) return;
    saveDraft();
    event.preventDefault();
    event.returnValue = "";
  });

  (async () => {
    populateFormulaAuthoringControls();
    renderFormulaCreateSelectedTags();
    setSidebarCollapsed(storedBool(sidebarStateKey));
    setEditorDockCollapsed(storedBool(editorDockStateKey));
    setArticlePublishDockCollapsed(storedBool(articlePublishDockStateKey), { persist: false });
    syncVisualViewportOffset();
    setPasswordVisible(false);
    updatePasswordActive();
    loadSavedLogin();
    const session = await request("/api/session").catch(() => ({ user: null }));
    csrfToken = session.csrfToken || "";
    const loggedIn = Boolean(session.user);
    setLoggedIn(loggedIn);
    if (loggedIn) {
      await loadServerContent();
      await loadImages();
      await loadHealth().catch(() => {});
      restoreDraftIfNeeded();
    } else {
      updateDraftStatus();
    }
    updateTypeFields();
    updatePreview();
    renderList(); renderRecentContent();
    setAdminView();
  })();
})();
