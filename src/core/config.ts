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
    private getDefaultConfig(): Config {
        const i18n = this.plugin.i18n;
        const playListI18n = i18n.playList;
        
        // 默认链接格式，使用带表情符号的示例
        const defaultLinkFormat = '- ![截图](截图)[😄标题 艺术家 时间 字幕](链接)';
        
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
                volume: 70,
                speed: 100,
                hotkey: true,
                loop: false,
                loopCount: 3,
                pauseAfterLoop: false,
                insertMode: 'insertBlock',
                showSubtitles: true,
                enableDanmaku: false,
                playerType: 'built-in',
                openMode: 'default',
                playerPath: 'PotPlayerMini64.exe',
                linkFormat: defaultLinkFormat,
                topBarButtons: {
                    screenshot: true,
                    timestamp: true,
                    loopSegment: true,
                    mediaNotes: true
                },
                alistConfig: {
                    server: 'http://localhost:5244',
                    username: 'admin',
                    password: ''
                }
            },
            proEnabled: false // 默认不启用Pro版本
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