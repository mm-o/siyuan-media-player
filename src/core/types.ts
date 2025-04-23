/**
 * 基础类型定义
 */
export type MediaType = 'video' | 'audio' | 'bilibili';
export type SettingType = 'slider' | 'checkbox' | 'select';

/**
 * B站相关类型
 */
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
    originalUrl?: string; // 原始链接
}

/**
 * B站视频特有属性
 */
interface BilibiliProps {
    aid?: string;         // B站av号
    bvid?: string;        // B站bv号
    cid?: string;         // B站视频cid
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
export interface MediaItem extends MediaBase, BilibiliProps, PlayControlProps {
    isPinned?: boolean;   // 是否置顶
    isFavorite?: boolean; // 是否收藏
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
        /** 是否插入到光标处 */
        insertAtCursor: boolean;
        /** 是否显示字幕 */
        showSubtitles: boolean;
        /** 是否启用弹幕 */
        enableDanmaku: boolean;
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
    /** Pro版本启用状态 */
    proEnabled?: boolean;
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

/**
 * 播放选项，包含字幕配置
 */
export interface PlayOptions extends PlayControlProps, BilibiliProps {
    originalUrl?: string;
    type?: 'bilibili' | 'bilibili-dash';
    title?: string;
    subtitle?: {
        url: string;
        type?: string;       // 字幕类型 (vtt, srt, ass)
        encoding?: string;   // 字幕编码
        escape?: boolean;    // 是否转义HTML标签
        style?: Record<string, string>;
    };
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