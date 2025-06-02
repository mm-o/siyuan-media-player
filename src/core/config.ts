import type { Plugin } from "siyuan";
import type { Config } from "./types";

/**
 * 配置管理器 - 管理播放器配置和持久化
 */
export class ConfigManager {
    private plugin: Plugin;
    private config: Config;
    
    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.config = this.getDefaultConfig();
    }
    
    /**
     * 获取默认配置
     */
    public getDefaultConfig(): Config {
        const i18n = this.plugin.i18n;
        const playListI18n = i18n.playList;
        
        // 默认链接格式，使用带表情符号的示例
        const defaultLinkFormat = '- ![截图](截图)[😄标题 艺术家 时间 字幕](链接)';
        const defaultMediaNotesTemplate = '# 📽️ 标题的媒体笔记\n- 📅 日 期：日期\n- ⏱️ 时 长：时长\n- 🎨 艺 术 家：艺术家\n- 🔖 类 型：类型\n- 🔗 链 接：[链接](链接)\n- ![封面](封面)\n- 📝 笔记内容：';
        
        return {
            playlists: [
                {
                    id: 'default',
                    name: playListI18n?.defaultList || '默认列表',
                    items: [],
                    isFixed: true
                },
                {
                    id: 'favorites',
                    name: playListI18n?.favorites || '收藏夹',
                    items: [],
                    isFixed: true
                }
            ],
            settings: {
                // 播放器设置
                volume: 70,
                speed: 100,
                hotkey: true,
                loop: false,
                loopCount: 3,
                pauseAfterLoop: false,
                loopPlaylist: false,
                loopSingle: false,
                insertMode: 'insertBlock',
                showSubtitles: true,
                enableDanmaku: false,
                playerType: 'built-in',
                openMode: 'default',
                playerPath: 'PotPlayerMini64.exe',
                
                // 通用设置
                linkFormat: defaultLinkFormat,
                mediaNotesTemplate: defaultMediaNotesTemplate,
                playlistDbId: '',
                screenshotWithTimestamp: false,
                
                // AList设置
                alistConfig: {
                    server: 'http://localhost:5244',
                    username: 'admin',
                    password: ''
                },
                
                // 账号/功能开关（持久化）
                pro: { enabled: false },
                alist: { showPanel: false }
            },
            bilibiliLogin: undefined
        };
    }
    
    /**
     * 获取UI状态的默认值(临时状态，不持久化)
     */
    getDefaultUIState(): any {
        return {
            qrcode: { data: '', key: '' },
            bilibili: { login: false, userInfo: null },
            alist: { enabled: false, showPanel: false },
            scripts: []
        };
    }
    
    /**
     * 加载配置
     */
    async load(): Promise<Config> {
        try {
            const saved = await this.plugin.loadData('config.json');
            if (!saved) return this.config;
            
            // 更新固定列表的名称为当前语言
            if (saved.playlists) {
                const i18n = this.plugin.i18n.playList;
                saved.playlists = saved.playlists.map(playlist => {
                    if (playlist.isFixed) {
                        if (playlist.id === 'default') {
                            playlist.name = i18n?.defaultList || '默认列表';
                        } else if (playlist.id === 'favorites') {
                            playlist.name = i18n?.favorites || '收藏夹';
                        }
                    }
                    return playlist;
                });
            }
            
            this.config = { ...this.config, ...saved };
        } catch (e) {
            console.error('加载配置失败:', e);
        }
        return this.config;
    }
    
    /**
     * 保存配置
     */
    async save(): Promise<void> {
        try {
            await this.plugin.saveData('config.json', this.config);
        } catch (e) {
            console.error('保存配置失败:', e);
        }
    }
    
    /**
     * 更新播放列表
     */
    async updatePlaylists(playlists: Config['playlists']): Promise<void> {
        this.config.playlists = playlists;
        await this.save();
    }
    
    /**
     * 更新设置
     */
    async updateSettings(settings: Config['settings']): Promise<void> {
        this.config.settings = settings;
        await this.save();
    }
    
    /**
     * 获取配置
     */
    getConfig(): Config {
        return this.config;
    }
} 