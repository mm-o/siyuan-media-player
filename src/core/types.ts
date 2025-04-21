/**
 * 媒体项接口定义
 */
export type MediaType = 'video' | 'audio' | 'bilibili';
export type SettingType = 'slider' | 'checkbox' | 'select';

// B站相关类型
export interface BilibiliUserInfo {
    face: string;
    level_info: {
        current_level: number;
        current_min: number;
        current_exp: number;
        next_exp: string | number;
    };
    mid: number;
    uname: string;
    wbi_img?: {
        img_url: string;
        sub_url: string;
    };
}

export interface BilibiliLogin {
    url?: string;
    refresh_token?: string;
    timestamp?: number;
    userInfo?: BilibiliUserInfo;
}

// 媒体相关类型
export interface MediaItem {
    id: string;           // 唯一标识符
    title: string;        // 媒体标题
    artist?: string;      // 作者/UP主名称
    artistIcon?: string;  // 作者/UP主头像
    duration?: string;   // 媒体时长，格式化后的时间字符串
    thumbnail?: string;   // 媒体缩略图
    url: string;         // 媒体URL
    originalUrl?: string;  // 原始链接
    type: MediaType;
    isPinned?: boolean;   // 是否置顶
    isFavorite?: boolean; // 是否收藏
    
    // B站视频特有属性
    aid?: string;        // B站av号
    bvid?: string;       // B站bv号
    cid?: string;        // B站视频cid
    headers?: Record<string, string>;
    
    // 播放控制属性
    startTime?: number;
    endTime?: number;
    isLoop?: boolean;
    loopCount?: number;
}

/**
 * 媒体信息接口
 */
export interface MediaInfo {
    title: string;        // 媒体标题
    artist?: string;      // 作者名称
    artistIcon?: string;  // 作者头像
    duration: string;     // 时长
    thumbnail: string;    // 缩略图
    url?: string;        // 媒体URL
    aid?: string;        // B站av号
    bvid?: string;       // B站bv号
    cid?: string;        // B站视频cid
}

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
        /** 是否插入到光标处 */
        insertAtCursor: boolean;
        /** 是否自动显示字幕 */
        showSubtitles: boolean;
        /** 播放器类型 */
        playerType: string;
        /** 外部播放器路径 */
        playerPath: string;
        /** 链接格式模板 */
        linkFormat: string;
    };
    /** B站登录信息 */
    bilibiliLogin?: BilibiliLogin;
    /** 播放列表 */
    playlists: PlaylistConfig[];
}

/**
 * 播放列表配置
 */
export interface PlaylistConfig {
    id: string;          // 列表ID
    name: string;        // 列表名称
    isFixed?: boolean;   // 是否为固定列表
    items: MediaItem[];  // 媒体项列表
}

export interface PlayOptions {
    startTime?: number;
    endTime?: number;
    isLoop?: boolean;
    loopCount?: number;
    originalUrl?: string;
    
    // B站视频特有选项
    type?: 'bilibili' | 'bilibili-dash';
    bvid?: string;
    cid?: string;
    headers?: Record<string, string>;
    title?: string;
    
    // 字幕选项
    subtitle?: {
        url: string;         // 字幕URL
        type?: string;       // 字幕类型 (vtt, srt, ass)
        encoding?: string;   // 字幕编码
        escape?: boolean;    // 是否转义HTML标签
        style?: Record<string, string>; // 字幕样式
    };
}

export interface VideoStream {
    video: {
        url: string
        size?: number
        // 保留视频其他属性
    }
    headers?: Record<string, string>
    mpdUrl?: string
}

export interface ISettingItem {
    key: string;
    value: number | boolean | string;
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
}

/**
 * 播放器类型枚举
 */
export enum PlayerType {
    BUILT_IN = 'built-in',
    POT_PLAYER = 'potplayer',
    BROWSER = 'browser'
}

// =============== 链接格式部分 ===============

/**
 * 链接格式支持的变量类型
 */
export enum LinkFormatVariable {
    TIME = 'time',           // 时间戳
    TITLE = 'title',         // 标题
    ARTIST = 'artist',       // 作者
    SUBTITLE = 'subtitle',   // 字幕
    CUSTOM = 'custom'        // 自定义文本
}

/**
 * 链接格式变量描述
 */
export interface LinkFormatVariableInfo {
    id: LinkFormatVariable;
    label: string;
    description: string;
    placeholder: string;
}