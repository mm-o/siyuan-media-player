/**
 * 基础类型定义
 */
export type MediaType = 'video' | 'audio' | 'bilibili';
export type SettingType = 'slider' | 'checkbox' | 'select' | 'textarea' | 'images' | 'custom' | 'account';

/**
 * B站登录信息（合并后）
 */
export interface BilibiliLogin {
    // 登录凭证
    sessdata: string;
    refresh_token: string;
    timestamp: number;
    // 用户信息
    mid: number;
    uname: string;
    face: string;
    level_info: {
        current_level: number;
        current_exp: number;
        next_exp: string | number;
    };
    money: number;
    vipStatus: number;
    wbi_img?: {
        img_url: string;
        sub_url: string;
    };
}

/**
 * 通用B站API响应
 */
export interface BiliApiResponse<T = any> {
    code: number;
    message: string;
    data: T;
}

/**
 * 媒体相关基础字段
 */
interface MediaBase {
    id: string;           // 唯一标识符
    title: string;        // 媒体标题
    url: string;          // 媒体URL
    type: MediaType;
    artist?: string;      // 作者/UP主名称
    artistIcon?: string;  // 作者/UP主头像
    artistId?: string;    // 作者/UP主ID
    duration?: string;    // 媒体时长，格式化后的时间字符串
    thumbnail?: string;   // 媒体缩略图
}

/**
 * B站视频特有属性
 */
interface BilibiliProps {
    bvid?: string;        // B站bv号
    headers?: Record<string, string>;
}

/**
 * 播放控制属性
 */
interface PlayControlProps {
    startTime?: number;
    endTime?: number;
    isLoop?: boolean;
    loopCount?: number;
}

/**
 * 媒体项（合并多个相关接口）
 */
export interface MediaItem {
    id: string;            // 媒体ID
    title: string;         // 标题
    type?: string;         // 类型：'video', 'audio', 'bilibili', 'folder'等
    url: string;           // 媒体URL
    originalUrl?: string;  // 原始URL(用于时间戳链接，WebDAV等)
    bvid?: string;         // B站BV号
    thumbnail?: string;    // 缩略图
    artist?: string;       // 艺术家/UP主名
    artistIcon?: string;   // 艺术家/UP主头像
    artistId?: string;     // 艺术家/UP主ID
    duration?: string;     // 时长(格式化后的字符串)
    startTime?: number;    // 开始时间(秒)
    endTime?: number;      // 结束时间(秒)
    isLoop?: boolean;      // 是否循环播放
    loopCount?: number;    // 循环次数
    source?: string;       // 来源, 如 'openlist'
    sourcePath?: string;   // 来源路径
    size?: number;         // 文件大小(字节)
    is_dir?: boolean;      // 是否为文件夹
    action?: string;       // 动作类型, 如 'navigateToTab'
    targetTabId?: string;  // 目标标签ID, 用于导航
}

/**
 * 媒体信息接口（简化版本的MediaItem）
 */
export interface MediaInfo extends MediaBase, BilibiliProps {}

/**
 * 配置文件类型定义
 */
export interface Config {
    /** 插件设置 */
    settings: {
        /** 音量大小 (0-100) */
        volume: number;
        /** 播放速度 (0.5-2.0) */
        speed: number;
        /** 是否开启热键 */
        hotkey: boolean;
        /** 是否循环播放 */
        loop: boolean;
        /** 循环次数 */
        loopCount?: number;
        /** 循环后暂停 */
        pauseAfterLoop?: boolean;
        /** 循环播放列表 */
        loopPlaylist?: boolean;
        /** 单项循环 */
        loopSingle?: boolean;
        /** 插入方式：光标处/追加/前置/剪贴板 */
        insertMode: string;
        /** 是否显示字幕 */
        showSubtitles: boolean;
        /** 是否启用弹幕 */
        enableDanmaku: boolean;
        /** 播放器类型 */
        playerType: string;
        /** 播放器打开方式 */
        openMode?: string;
        /** 外部播放器路径 */
        playerPath: string;
        /** 链接格式模板 */
        linkFormat: string;
        /** 截图包含时间戳 */
        screenshotWithTimestamp?: boolean;
        /** 是否启用数据库功能 */
        enableDatabase?: boolean;
        /** 播放列表数据库 */
        playlistDb?: { id: string; avId?: string };
        /** 播放列表视图状态 */
        playlistView?: { mode: string; tab: string; expanded: string[] };
            /** OpenList配置 */
    openlistConfig?: {
            server: string;    // 服务器地址
            username: string;  // 用户名
            password: string;  // 密码
            token?: string;    // 认证令牌
            connected?: boolean; // 连接状态
        };
        /** WebDAV配置 */
        webdavConfig?: {
            server: string;    // 服务器地址
            username: string;  // 用户名
            password: string;  // 密码
            connected?: boolean; // 连接状态
        };
        /** 目标笔记本 */
        targetNotebook?: { id: string; name: string };
        /** 媒体笔记模板 */
        mediaNotesTemplate?: string;
        // UI临时状态(不持久化)
        qrcode?: { data: string; key: string };
        bilibili?: { login: boolean; userInfo: any };
        openlist?: { enabled: boolean; showPanel: boolean };
        webdav?: { enabled: boolean };
        pro?: { enabled: boolean };
    };
    /** B站登录信息 */
    bilibiliLogin?: BilibiliLogin;
}

/**
 * 播放列表配置
 */
export interface PlaylistConfig {
    id: string;          // 列表ID
    name: string;        // 列表名称
    isFixed?: boolean;   // 是否为固定列表
    items: MediaItem[];  // 媒体项列表
    path?: string;       // 媒体源路径（本地文件夹/openlist/思源/B站收藏夹）
    sourceType?: string; // 源类型：folder/openlist/siyuan/bilibili
    openlistPath?: string;  // OpenList当前路径 (已废弃，使用path替代)
    openlistPathParts?: {name: string; path: string}[];  // OpenList路径各部分
}

/**
 * 播放选项，包含字幕配置
 */
export interface PlayOptions extends PlayControlProps, BilibiliProps {
    type?: 'bilibili' | 'bilibili-dash';
    title?: string;
    subtitle?: {
        url: string;
        type?: string;       // 字幕类型 (vtt, srt, ass)
        encoding?: string;   // 字幕编码
        escape?: boolean;    // 是否转义HTML标签
        style?: Record<string, string>;
    };
    dashData?: any;         // 传给dashjs插件的dash数据 (旧格式，即将移除)
    biliDash?: any;         // B站返回的dash数据结构
}

/**
 * 视频流数据
 */
export interface VideoStream {
    video: {
        url: string;
        size?: number;
    };
    headers?: Record<string, string>;
    mpdUrl?: string;
}

/**
 * 设置项
 */
export interface ISettingItem {
    key: string;
    value: number | boolean | string | Array<{url: string; caption?: string}>;
    type: SettingType;
    title: string;
    description?: string;
    slider?: {
        min: number;
        max: number;
        step: number;
    };
    options?: Array<{
        label: string;
        value: string;
    }>;
    rows?: number;          // textarea行数
    placeholder?: string;   // 输入框占位文本
    status?: any;           // 状态信息，用于自定义类型
    button?: {
        config: string;
        save: string;
        exit: string;
        state?: string;
        buttonText?: string;
        username?: string;
        userId?: string;
    };
    show?: {
        config: string[];
        exit: string[];
    };
    hide?: {
        save: string[];
    };
    tab?: string;
    displayCondition?: (state: any) => boolean;
    onAction?: () => Promise<void> | void;
    onChange?: (value: any) => Promise<void> | void;
    avatar?: string;
    name?: string;
    level?: string | number;
    uid?: string | number;
    nickname?: string;
    actionType?: string;
}

/**
 * 播放器类型枚举
 */
export enum PlayerType {
    BUILT_IN = 'built-in',
    POT_PLAYER = 'potplayer',
    BROWSER = 'browser'
}

/**
 * 链接格式相关类型
 */
export enum LinkFormatVariable {
    TIME = 'time',
    TITLE = 'title',
    ARTIST = 'artist',
    SUBTITLE = 'subtitle',
    CUSTOM = 'custom'
}

export interface LinkFormatVariableInfo {
    id: LinkFormatVariable;
    label: string;
    description: string;
    placeholder: string;
}

/**
 * B站视频AI总结响应接口
 */
export interface BiliVideoAiSummary {
    code: number;
    message: string;
    ttl: number;
    data: {
        code: number;
        model_result: {
            result_type: number;
            summary: string;
            outline?: {
                title: string;
                part_outline: {
                    timestamp: number;
                    content: string;
                }[];
                timestamp: number;
            }[];
        };
        stid: string;
        status: number;
        like_num: number;
        dislike_num: number;
    };
}

/**
 * 组件实例接口定义，用于统一生命周期管理
 */
export interface ComponentInstance {
    $destroy?: () => void;
    $set?: (props: any) => void;
    $on?: (event: string, callback: (event: CustomEvent<any>) => void) => void;
    addMedia?: (url: string, options?: any) => void;
    [key: string]: any;
}