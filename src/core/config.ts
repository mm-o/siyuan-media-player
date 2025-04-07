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
        const i18n = this.plugin.i18n.playList;
        return {
            playlists: [
                {
                    id: 'default',
                    name: i18n?.defaultList || '默认列表',
                    items: [],
                    isFixed: true
                },
                {
                    id: 'favorites',
                    name: i18n?.favorites || '收藏夹',
                    items: [],
                    isFixed: true
                }
            ],
            settings: {
                volume: 70,
                speed: 100,
                hotkey: true,
                loop: false,
                insertAtCursor: true,
            }
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