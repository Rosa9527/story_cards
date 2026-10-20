// ===== 剧情抽卡（Story Cards）全局常量 =====
// 命名前缀统一 sc / SC_ / storyCards，避免与其他扩展的全局作用域撞名
// （js/ 下所有文件共享全局作用域）。
const SC_MODULE_NAME = 'StoryCards';
const SC_MODULE_DISPLAY_NAME = '剧情抽卡';
const SC_MODULE_VERSION = '1.0.0';

// ---------- DOM ID / class ----------
const SC_MENU_ITEM_ID = 'sc-menu-item';
const SC_MENU_API_ID = 'sc-menu-api';
const SC_FLOATING_BUTTON_ID = 'sc-floating-button';
const SC_PANEL_ID = 'sc-panel';
const SC_SCOPE_TREE_ID = 'sc-scope-tree';
const SC_DRAW_BUTTON_ID = 'sc-draw-button';
const SC_SUMMARY_ID = 'sc-scope-summary';
const SC_AVOID_REPEAT_ID = 'sc-avoid-repeat';
const SC_SHOW_FLOAT_ID = 'sc-show-float';
const SC_IMPORT_CARDS_BUTTON_ID = 'sc-import-cards';
const SC_EXPORT_CARDS_BUTTON_ID = 'sc-export-cards';
const SC_CARD_STATUS_ID = 'sc-card-status';
const SC_IMPORT_FILE_INPUT_ID = 'sc-import-file-input';
const SC_RESULT_ID = 'sc-result';
const SC_VIEW_INJECT_BUTTON_ID = 'sc-view-inject';
const SC_INJECT_PREVIEW_ID = 'sc-inject-preview';
const SC_INJECT_COPY_BUTTON_ID = 'sc-inject-copy';
const SC_MENU_ICON_CLASS = 'fa-solid fa-clone';
const SC_DRAW_ICON_CLASS = 'fa-solid fa-dice';

// ---------- 设置存储 ----------
// 存在宿主的 extension_settings 下（随酒馆设置持久化）。
const SC_SETTINGS_NAMESPACE = 'storyCards';
// 宿主读不到设置容器时的兜底存储，挂 globalThis（刷新即失效）。
// 不能挂 context：TauriTavern 的 getContext() 每次返回新对象，挂上去等于没存。
const SC_FALLBACK_SETTINGS_KEY = '__sc_fallback_settings__';

const SC_DEFAULT_SETTINGS = Object.freeze({
  // 已勾选的抽卡范围：{ [卡组]: { [分类]: { [主题]: true } } }
  // 只记录被勾上的叶子（主题）；卡组 / 分类的勾选状态由叶子推导，避免三处状态打架。
  selectedLeaves: {},
  // 悬浮按钮开关（手机端面板入口）。
  showFloatingButton: true,
  // 「抽过不重复」开关。
  avoidRepeat: true,
  // 悬浮按钮位置（视口坐标，左上角）。null = 用默认位置（右下角）。
  floatX: null,
  floatY: null,
});

// 悬浮按钮拖动：尺寸与贴边留白（与 style.css 里的 .sc-floating-button 保持一致）。
const SC_FLOAT_SIZE = 38;
const SC_FLOAT_MARGIN = 8;
// 判定「这是一次拖动」而不是「点击」的位移阈值（像素）。
const SC_FLOAT_DRAG_THRESHOLD = 5;
// 长按隐藏：按住不放这么久（且中途没拖动）就把悬浮球收起来。
// 与 Kaleidoscope 的悬浮球保持同一手感（650ms / 8px）。
const SC_FLOAT_LONG_PRESS_MS = 650;
const SC_FLOAT_LONG_PRESS_SLOP = 8;

// 按聊天记录已抽卡 ID 的存储位置（chatMetadata），每个聊天各记一份。
const SC_CHAT_DRAWN_META_KEY = 'story_cards_drawn';

// ---------- 注入 ----------
// 注入槽位 key：与其它扩展不冲突即可，宿主按 key 覆盖同一槽位。
const SC_INJECT_KEY = 'story-cards-draw';
// extension_prompt_types: NONE=-1, IN_PROMPT=0, IN_CHAT=1, BEFORE_PROMPT=2
// extension_prompt_roles: SYSTEM=0, USER=1, ASSISTANT=2
// TauriTavern 2.x 不提供这两个枚举对象，按已知数值常量兜底（与 Kaleidoscope 同款）。
const SC_INJECT_TYPE_IN_CHAT = 1;
const SC_INJECT_ROLE_SYSTEM = 0;
// 注入深度：0 = 贴在最后一条消息（刚发出去的抽卡触发短语）正下方。
const SC_INJECT_DEPTH = 0;
// 注入的超时兜底：正常情况下 generationEnded / generationStopped 会清空槽位；
// 万一宿主压根没开始生成（发送被拦、命令没触发生成），到这个时间也要清掉，
// 不能让卡面一直挂在槽位里、跟着之后某条无关消息发出去。
const SC_INJECT_TTL_MS = 60000;
// 重放记录的有效期：超过这个时间就不再把旧卡塞回提示词（防止很久以后点的
// 「重新生成」把早就结束的那张卡又捞回来）。
const SC_RETRY_REPLAY_TTL_MS = 10 * 60 * 1000;

// ---------- 发送 ----------
// 点「剧情抽卡」后，输入框里填的触发短语。刻意极短：聊天记录干净、上下文零负担，
// 真正的卡面内容走系统导演注注入。
const SC_TRIGGER_TEXT = '【剧情抽卡】';
// 发送确认轮询：等宿主把消息提交进 chat。
const SC_SEND_CONFIRM_TIMEOUT_MS = 6000;
const SC_SEND_CONFIRM_INTERVAL_MS = 120;
// 填完输入框到点发送之间的等待：给宿主自己的输入监听（自动补全、字数统计）留一拍。
const SC_SEND_SETTLE_MS = 60;

// ---------- 导入 / 导出卡片 ----------
// 玩家导入的卡牌存在设置里（随酒馆设置持久化），与构建期编进 index.js 的
// 卡库合并；同 id 时以导入的为准。
const SC_CUSTOM_CARDS_LIMIT = 5000;
// 导出文件的格式标识与版本号（导入时只认 cards 数组，version 供以后兼容）。
const SC_CARD_JSON_FORMAT = 'story-cards';
const SC_CARD_JSON_VERSION = 1;
// 单个 JSON 文件大小上限（16 MB）：5000 张卡面的正常体积远低于这个量级，
// 超过基本是选错了文件。
const SC_CARD_JSON_MAX_BYTES = 16 * 1024 * 1024;

// ---------- 菜单 / 启动 ----------
const SC_MENU_RETRY_COUNT = 40;
const SC_BOOTSTRAP_RETRY_COUNT = 60;
const SC_BOOTSTRAP_RETRY_INTERVAL_MS = 500;

// ---------- 全局标记 key（防止重复挂载 / 重复 bootstrap） ----------
const SC_BOOTSTRAP_RUNTIME_KEY = '__story_cards_bootstrapped__';
const SC_MENU_RECOVERY_OBSERVER_KEY = '__story_cards_menu_observer__';
const SC_HOST_EVENT_WATCHDOG_KEY = '__story_cards_event_watchdog__';
const SC_HOST_EVENT_WATCHDOG_INTERVAL_MS = 2000;
const SC_APP_READY_HANDLER_KEY = '__story_cards_app_ready__';
const SC_GEN_ENDED_HANDLER_KEY = '__story_cards_gen_ended__';
const SC_GEN_STOPPED_HANDLER_KEY = '__story_cards_gen_stopped__';
const SC_GEN_STARTED_HANDLER_KEY = '__story_cards_gen_started__';
const SC_CHAT_CHANGED_HANDLER_KEY = '__story_cards_chat_changed__';
// 悬浮按钮的窗口 resize 监听（挂一次就够，避免重复 bootstrap 时叠加）。
const SC_FLOAT_RESIZE_HOOK_KEY = '__story_cards_float_resize__';

// 本轮抽卡记录（内存态，供重新生成时重放注入）。
const SC_LAST_DRAW_KEY = '__story_cards_last_draw__';
// 最近一次注入的原文（内存态，供面板「查看注入的提示词」显示）。
const SC_LAST_INJECT_KEY = '__story_cards_last_inject__';
// 注入超时清理的定时器句柄（避免重复排程 / 清理后残留）。
const SC_INJECT_EXPIRY_TIMER_KEY = '__story_cards_inject_expiry__';
